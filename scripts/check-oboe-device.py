#!/usr/bin/env python3
"""Debug-only, real-device lifecycle and Phase 3.2 native audio decoding checks.
ADB=/path/to/adb python3 scripts/check-oboe-device.py [--listen] [--track <content_uri>]
Requires the newly built APK installed, foreground, and unlocked.
"""
import json
import os
import subprocess
import sys
import time
import uuid

ADB = os.environ.get('ADB', 'adb')
COMPONENT = 'com.remixer.app/expo.modules.audioplayback.NativeAudioTestReceiver'

def adb(*args):
    return subprocess.check_output([ADB, *args], text=True, timeout=20)

def command(name, volume=None, uri=None):
    request = uuid.uuid4().hex
    args = ['shell', 'am', 'broadcast', '-n', COMPONENT, '--es', 'command', name,
            '--es', 'requestId', request]
    if volume is not None:
        args += ['--ef', 'volume', str(volume)]
    if uri is not None:
        args += ['--es', 'uri', str(uri)]
    adb(*args)
    logs = adb('logcat', '-d', '-s', 'RemixerOboeTest:I', '*:S')
    line = next((line for line in reversed(logs.splitlines()) if f'id={request} ' in line), None)
    assert line and 'result=true' in line, f'{name} failed: {line}'
    result = json.loads(line[line.index('{'):])
    print(name, json.dumps(result), flush=True)
    return result

def get_first_media_track():
    for arg_idx, arg in enumerate(sys.argv):
        if arg == '--track' and arg_idx + 1 < len(sys.argv):
            return sys.argv[arg_idx + 1]
    try:
        out = adb('shell', 'content', 'query', '--uri', 'content://media/external/audio/media', '--projection', '_id:title')
        for line in out.splitlines():
            if '_id=' in line:
                for token in line.replace(',', ' ').split():
                    if token.startswith('_id='):
                        track_id = token.split('=')[1]
                        return f'content://media/external/audio/media/{track_id}'
    except Exception as e:
        print('Notice: Could not automatically query MediaStore via adb shell content query:', e)
    return None

try:
    command('release')
    initial = command('initialize')
    assert initial['initialized'] and not initial['running']
    assert initial['sampleRate'] > 0 and initial['channelCount'] == 2

    # Phase 3.2 Real Audio Track Decoding Test
    track_uri = get_first_media_track()
    if track_uri:
        print(f'Testing Phase 3.2 Real Track Decoding with: {track_uri}', flush=True)
        load_res = command('loadTrack', uri=track_uri)
        diag = command('diagnostics')
        assert diag.get('trackLoaded', False), 'Track must be marked loaded in native engine'
        print(f"Track loaded: {diag.get('trackSampleRate')} Hz, {diag.get('trackChannels')} channels, duration={diag.get('durationUs')} us", flush=True)

        command('volume', 0.8)
        started = command('start')
        assert started['running']

        listen_secs = 10 if '--listen' in sys.argv else 3
        print(f'PLAYING REAL TRACK through Oboe for {listen_secs} seconds...', flush=True)
        time.sleep(listen_secs)

        active = command('diagnostics')
        assert active.get('decodedFrames', 0) > 0, 'Decoder must have decoded frames'
        assert active.get('playedFrames', 0) > 0, 'Oboe callback must have played frames'
        assert active['callbackCount'] > 0, 'Oboe callback count must advance'
        print(f"Active playback stats: decoded={active.get('decodedFrames')} frames, played={active.get('playedFrames')} frames, callbacks={active['callbackCount']}", flush=True)

        stopped = command('stop')
        assert not stopped['running']
        command('release')
        print('PASS: Phase 3.2 real audio track decoded via AMediaCodec and played through Oboe!', flush=True)
    else:
        print('No local audio URI found via shell query; running foundation tone verification...', flush=True)
        for value, expected in [(-1, 0), (2, 1), (0, 0), (0.05, 0.05)]:
            assert abs(command('volume', value)['volume'] - expected) < 1e-5
        started = command('start')
        assert started['running']
        time.sleep(1)
        active = command('diagnostics')
        assert active['callbackCount'] > started['callbackCount']
        command('volume', 0.05)
        if '--listen' in sys.argv:
            print('LISTEN: 440 Hz tone for 5 seconds', flush=True)
            time.sleep(5)
        command('stop')
        command('release')
        print('PASS: foundation stream verified', flush=True)

finally:
    try:
        command('stop')
        command('release')
    except Exception:
        pass
