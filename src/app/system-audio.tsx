import React from 'react';
import { Redirect } from 'expo-router';

// Keep existing Settings links and deep links pointing to the unified console.
export default function SystemAudioRoute() {
  return <Redirect href={{ pathname: '/', params: { mode: 'system' } }} />;
}
