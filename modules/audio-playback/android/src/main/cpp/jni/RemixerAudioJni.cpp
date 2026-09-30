#include <jni.h>
#include "../audio/RemixerAudioEngine.h"

static remixer::RemixerAudioEngine& engine() {
  static auto* instance = new remixer::RemixerAudioEngine();
  return *instance;
}

extern "C" {
JNIEXPORT void JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_setMasterFx(
    JNIEnv*, jobject, jint index, jfloat value) { engine().setMasterFx(index, value); }


JNIEXPORT jboolean JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_initialize(JNIEnv*, jobject) {
  return engine().initialize();
}

JNIEXPORT jboolean JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_loadTrackFd(
    JNIEnv*, jobject, jint deckIndex, jint fd, jlong offset, jlong length) {
  return engine().loadTrackFd(deckIndex, fd, offset, length);
}

JNIEXPORT jboolean JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_playDeck(
    JNIEnv*, jobject, jint deckIndex) {
  return engine().playDeck(deckIndex);
}

JNIEXPORT jboolean JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_pauseDeck(
    JNIEnv*, jobject, jint deckIndex) {
  return engine().pauseDeck(deckIndex);
}

JNIEXPORT jboolean JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_start(JNIEnv*, jobject) {
  return engine().start();
}

JNIEXPORT jboolean JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_stop(JNIEnv*, jobject) {
  return engine().stop();
}

JNIEXPORT jboolean JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_pause(JNIEnv*, jobject) {
  return engine().pauseDeck(0);
}

JNIEXPORT jboolean JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_seekTo(
    JNIEnv*, jobject, jint deckIndex, jdouble positionSeconds) {
  return engine().seekTo(deckIndex, positionSeconds);
}

JNIEXPORT jdouble JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_getPosition(
    JNIEnv*, jobject, jint deckIndex) {
  return engine().getPosition(deckIndex);
}

JNIEXPORT jdouble JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_getDuration(
    JNIEnv*, jobject, jint deckIndex) {
  return engine().getDuration(deckIndex);
}

JNIEXPORT jboolean JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_isDeckPlaying(
    JNIEnv*, jobject, jint deckIndex) {
  return engine().isDeckPlaying(deckIndex);
}

JNIEXPORT void JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_release(JNIEnv*, jobject) {
  engine().release();
}

JNIEXPORT void JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_setTestToneVolume(
    JNIEnv*, jobject, jfloat volume) {
  engine().setTestToneVolume(volume);
}

JNIEXPORT void JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_setVolume(
    JNIEnv*, jobject, jint deckIndex, jfloat volume, jint seq, jlong tGesture) {
  engine().setVolume(deckIndex, volume, seq, tGesture);
}

JNIEXPORT void JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_setEq(
    JNIEnv*, jobject, jint deckIndex, jint band, jfloat value, jboolean kill) {
  engine().setEq(deckIndex, band, value, kill);
}

JNIEXPORT void JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_setRate(
    JNIEnv*, jobject, jint deckIndex, jfloat rate) {
  engine().setRate(deckIndex, rate);
}

JNIEXPORT jstring JNICALL Java_expo_modules_audioplayback_NativeAudioBridge_diagnosticsJson(
    JNIEnv* env, jobject) {
  const auto json = engine().getDiagnostics();
  return env->NewStringUTF(json.c_str());
}

}
