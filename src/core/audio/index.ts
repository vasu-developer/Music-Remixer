import { Platform } from 'react-native';
import { IAudioEngine } from './types';
import { MockAudioEngine } from './MockAudioEngine';
import { RealAndroidAudioEngine } from './RealAndroidAudioEngine';

export * from './types';
export * from './MockAudioEngine';
export * from './RealAndroidAudioEngine';
export * from './nativeAudio';

let currentEngine: IAudioEngine =
  Platform.OS === 'android'
    ? RealAndroidAudioEngine.getInstance()
    : MockAudioEngine.getInstance();

export function getAudioEngine(): IAudioEngine {
  return currentEngine;
}

export function setAudioEngine(engine: IAudioEngine): void {
  currentEngine = engine;
}
