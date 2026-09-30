"""Verify an APK contains the UI, Kotlin bridge and native master DSP entry point."""
import hashlib
import sys
import zipfile
from pathlib import Path
apk = Path(sys.argv[1])
with zipfile.ZipFile(apk) as archive:
    bundle = archive.read('assets/index.android.bundle')
    for label in ['MASTER SOUND', 'PREAMP', 'setMasterFx']:
        assert label.encode() in bundle or label.encode('utf-16le') in bundle, f'Missing bundled UI/bridge: {label}'
    dex = b''.join(archive.read(name) for name in archive.namelist() if name.endswith('.dex'))
    assert b'setMasterFx' in dex, 'Missing Kotlin bridge'
    native = archive.read('lib/arm64-v8a/libremixer_audio.so')
    assert b'Java_expo_modules_audioplayback_NativeAudioBridge_setMasterFx' in native, 'Missing native DSP bridge'
print('PASS: standalone UI, Kotlin bridge and arm64 native DSP are in this APK')
print('SHA256', hashlib.sha256(apk.read_bytes()).hexdigest())
