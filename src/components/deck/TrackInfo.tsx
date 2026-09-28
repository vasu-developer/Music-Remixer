import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { TrackArtwork } from '@/components/library/TrackArtwork';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDeckStore } from '@/store/useDeckStore';
import { DeckId, Track } from '@/types';
import { DJColors, DJFonts } from '@/constants/theme';

export interface TrackInfoProps {
  deckId: DeckId;
  track: Track | null;
  duration: number;
}

export const TrackInfo: React.FC<TrackInfoProps> = ({
  deckId,
  track,
  duration,
}) => {
  const currentTime = useDeckStore((s) => Math.floor((deckId === 'A' ? s.deckA : s.deckB).currentTime));
  const router = useRouter();
  const isDeckA = deckId === 'A';
  const accentColor = isDeckA ? DJColors.deckA : DJColors.deckB;
  const darkAccentColor = isDeckA ? DJColors.deckADark : DJColors.deckBDark;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const remaining = Math.max(0, duration - currentTime);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => router.push('/library')}
        style={[
          styles.artworkWrapper,
          { borderColor: accentColor, backgroundColor: darkAccentColor },
        ]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Load track into Deck ${deckId}`}>
        {track?.artworkUrl ? <TrackArtwork uri={track.artworkUrl} size={49} /> : <View style={styles.vinylCenterGroove}>
          <Ionicons name="musical-notes" size={16} color={accentColor} />
        </View>}
        <View style={[styles.deckLetterTag, { backgroundColor: accentColor }]}>
          <Text style={styles.deckLetterText}>{deckId}</Text>
        </View>
      </Pressable>

      <View style={styles.metaContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {track ? track.title : `No Track Loaded on Deck ${deckId}`}
          </Text>
        </View>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {track ? `${track.artist}${track.album ? ` • ${track.album}` : track.genre ? ` • ${track.genre}` : ''}` : 'Tap artwork to browse library'}
        </Text>

        <View style={styles.timeRow}>
          <View style={styles.timeBadge}>
            <Text style={styles.timeLabel}>ELAPSED</Text>
            <Text style={[styles.timeDigits, { color: accentColor }]}>
              {formatTime(currentTime)}
            </Text>
          </View>
          <View style={styles.timeBadge}>
            <Text style={styles.timeLabel}>REMAIN</Text>
            <Text style={[styles.timeDigits, { color: DJColors.textSecondary }]}>
              -{formatTime(remaining)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: DJColors.surfaceRaised,
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
  },
  artworkWrapper: {
    width: 52,
    height: 52,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  vinylCenterGroove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DJColors.surfaceInset,
    borderWidth: 1,
    borderColor: DJColors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckLetterTag: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 14,
    height: 14,
    borderBottomRightRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckLetterText: {
    fontFamily: DJFonts.condensed,
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
  },
  metaContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackTitle: {
    flexShrink: 1,
    fontFamily: DJFonts.condensed,
    fontSize: 13,
    fontWeight: '800',
    color: DJColors.textPrimary,
    letterSpacing: 0.3,
  },
  trackArtist: {
    fontFamily: DJFonts.display,
    fontSize: 10.5,
    color: DJColors.textSecondary,
    marginTop: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 4,
  },
  timeLabel: {
    fontFamily: DJFonts.mono,
    fontSize: 7.5,
    fontWeight: '700',
    color: DJColors.textMuted,
    letterSpacing: 0.5,
  },
  timeDigits: {
    fontFamily: DJFonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
});
