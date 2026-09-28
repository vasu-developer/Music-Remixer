import React, { memo, useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DJColors } from '@/constants/theme';

// Render at the existing artwork slot size; never decode original-size artwork
// in JS. Missing/inaccessible provider artwork keeps the musical-note fallback.
export const TrackArtwork = memo(function TrackArtwork({ uri, size = 44 }: { uri?: string; size?: number }) {
  const [failedUri, setFailedUri] = useState<string | undefined>();
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Ionicons name="musical-note" size={18} color={DJColors.textSecondary} />
    {uri && failedUri !== uri && <Image source={{ uri }} style={StyleSheet.absoluteFill}
      contentFit="cover" cachePolicy="memory" recyclingKey={uri} transition={0}
      onError={() => setFailedUri(uri)} accessibilityLabel="Album artwork" />}
  </View>;
});
