#!/usr/bin/env python3
"""Phase 3.2 Physical Continuous Playback & Real-Time Buffer Diagnostics Test
Usage:
  ADB=/usr/bin/adb python3 scripts/measure-volume-latency.py [--duration 30|60] [--track <content_uri>]
"""
import argparse
import json
import os
import subprocess
import sys
import time
import uuid

ADB = os.environ.get("ADB", "/usr/bin/adb")
COMPONENT = "com.remixer.app/expo.modules.audioplayback.NativeAudioTestReceiver"

def adb(*args):
    return subprocess.check_output([ADB, *args], text=True, timeout=30)

def send_command(name, volume=None, uri=None):
    request = uuid.uuid4().hex
    args = ["shell", "am", "broadcast", "-n", COMPONENT, "--es", "command", name,
            "--es", "requestId", request]
    if volume is not None:
        args += ["--ef", "volume", str(volume)]
    if uri is not None:
        args += ["--es", "uri", str(uri)]
    adb(*args)
    logs = adb("logcat", "-d", "-s", "RemixerOboeTest:I", "*:S")
    line = next((l for l in reversed(logs.splitlines()) if f"id={request} " in l), None)
    assert line and "result=true" in line, f"{name} failed: {line}"
    return json.loads(line[line.index("{"):])

def get_track_uri():
    try:
        out = adb("shell", "content", "query", "--uri", "content://media/external/audio/media", "--projection", "_id:title")
        for line in out.splitlines():
            if "_id=" in line:
                for token in line.replace(",", " ").split():
                    if token.startswith("_id="):
                        return f"content://media/external/audio/media/{token.split('=')[1]}"
    except Exception as e:
        print("Query failed:", e)
    return None

def main():
    parser = argparse.ArgumentParser(description="Phase 3.2 Diagnostics Runner")
    parser.add_argument("--duration", type=int, default=30, help="Playback test duration in seconds (e.g. 30 or 60)")
    parser.add_argument("--track", type=str, default=None, help="Explicit track URI")
    args = parser.parse_args()

    track_uri = args.track or get_track_uri()
    if not track_uri:
        print("ERROR: No local MediaStore track found.")
        sys.exit(1)

    print("=" * 70)
    print(f"PHASE 3.2 — CONTINUOUS NATIVE PCM PLAYBACK TEST ({args.duration}s)")
    print(f"Device: Infinix X6851 | Target URI: {track_uri}")
    print("=" * 70)

    # 1. Stop any existing playback session
    try:
        send_command("stop")
        send_command("release")
    except Exception:
        pass

    # 2. Initialize Oboe stream
    print("\n[1/5] Initializing low-latency Oboe stream...")
    init_res = send_command("initialize")
    sample_rate = init_res.get("sampleRate", 0)
    burst = init_res.get("framesPerBurst", 0)
    buffer_sz = init_res.get("bufferSize", 0)
    api = init_res.get("audioApi", "Unknown")
    print(f"      -> Oboe stream: {api} @ {sample_rate} Hz, burst={burst}, buffer={buffer_sz}")

    # 3. Load track and start decoder pre-buffering
    print("\n[2/5] Loading track into AMediaExtractor / AMediaCodec...")
    load_res = send_command("loadTrack", uri=track_uri)
    diag = send_command("diagnostics")
    assert diag.get("trackLoaded", False), "Track failed to load"
    print(f"      -> Codec: mime={diag.get('trackChannels')}ch {diag.get('trackSampleRate')} Hz, encoding={diag.get('pcmEncoding')}, duration={diag.get('durationUs')} us")

    # 4. Start playback (pre-buffer 24,000 frames then start stream)
    print("\n[3/5] Starting playback with pre-buffer...")
    send_command("volume", 1.0)
    start_res = send_command("start")
    assert start_res.get("running", False), "Stream failed to start"
    print("      -> Audio stream started successfully.")

    # 5. Playback monitoring loop
    print(f"\n[4/5] Monitoring physical playback for {args.duration} seconds...")
    start_time = time.time()
    next_check = start_time + 5.0
    volume_steps = [(5, 0.5), (10, 0.2), (15, 0.8), (20, 0.0), (25, 1.0)]
    step_idx = 0

    while time.time() - start_time < args.duration:
        elapsed = time.time() - start_time
        # Check volume steps
        if step_idx < len(volume_steps) and elapsed >= volume_steps[step_idx][0]:
            target_vol = volume_steps[step_idx][1]
            send_command("volume", target_vol)
            d = send_command("diagnostics")
            print(f"      [{elapsed:4.1f}s] Volume step -> {int(target_vol*100)}% (latency={d.get('lastVolumeLatencyUs', 0)} us)")
            step_idx += 1

        if time.time() >= next_check:
            d = send_command("diagnostics")
            buffered = d.get("bufferedFrames", 0)
            underruns = d.get("audioUnderrunCount", 0)
            played = d.get("playedFrames", 0)
            decoded = d.get("decodedFrames", 0)
            pct_buf = min(100, int((buffered / 131072.0) * 100))
            bar = "█" * (pct_buf // 5) + "░" * (20 - (pct_buf // 5))
            print(f"      [{elapsed:4.1f}s] Buffer: [{bar}] {buffered:6d} frames ({pct_buf:2d}%) | Played: {played:7d} | Decoded: {decoded:7d} | Underruns: {underruns}")
            next_check = time.time() + 5.0

        time.sleep(0.5)

    # 6. Final diagnostics
    print("\n[5/5] Collecting final playback diagnostics...")
    final_diag = send_command("diagnostics")
    send_command("stop")
    send_command("release")

    # Metrics
    audio_underruns = final_diag.get("audioUnderrunCount", 0)
    underrun_frames = final_diag.get("underrunFrames", 0)
    min_buf = final_diag.get("minBufferedFrames", 0)
    max_buf = final_diag.get("maxBufferedFrames", 0)
    avg_buf = final_diag.get("averageBufferedFrames", 0)
    decoder_stalls = final_diag.get("decoderStalls", 0)
    pcm_encoding = final_diag.get("pcmEncoding", "UNKNOWN")
    track_rate = final_diag.get("trackSampleRate", 0)
    oboe_rate = final_diag.get("sampleRate", 0)
    vol_latency_us = final_diag.get("lastVolumeLatencyUs", 0)
    stream_latency_ms = final_diag.get("streamLatencyMs", 0.0)

    is_pass = (audio_underruns == 0) and (underrun_frames == 0) and (min_buf > 0)

    print("\n" + "=" * 70)
    print("PHASE 3.2 CONTINUOUS PLAYBACK REPORT")
    print("=" * 70)
    print(f"PHASE 3.2 FIX STATUS: {'PASS' if is_pass else 'FAIL'}")
    print("Physical device: Infinix X6851")
    print(f"Playback: {'smooth' if is_pass else 'stuttering'}")
    print(f"Underruns: {audio_underruns}")
    print(f"Underrun frames: {underrun_frames}")
    print(f"Minimum buffer: {min_buf} frames ({min_buf / oboe_rate * 1000:.1f} ms)")
    print(f"Maximum buffer: {max_buf} frames ({max_buf / oboe_rate * 1000:.1f} ms)")
    print(f"Average buffer: {avg_buf} frames ({avg_buf / oboe_rate * 1000:.1f} ms)")
    print(f"Decoder stalls: {decoder_stalls}")
    print(f"Codec output format: {pcm_encoding}")
    print(f"Track sample rate: {track_rate} Hz")
    print(f"Oboe sample rate: {oboe_rate} Hz")
    print(f"Duration tested: {args.duration} seconds")
    print(f"Volume response: immediate ({vol_latency_us} us control latency + {stream_latency_ms:.1f} ms DAC)")
    print("=" * 70)

if __name__ == "__main__":
    main()
