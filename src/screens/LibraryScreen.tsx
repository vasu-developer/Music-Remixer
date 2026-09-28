import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  AppState,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Track } from '@/types';
import { DJColors, DJFonts } from '@/constants/theme';
import { useLibraryStore } from '@/store/useLibraryStore';
import { TrackArtwork } from '@/components/library/TrackArtwork';
import { useDeckStore } from '@/store/useDeckStore';
import { TactileButton } from '@/components/common/TactileButton';
import { BottomNavBar } from '@/components/navigation/BottomNavBar';

export const LibraryScreen: React.FC = () => {
  const router = useRouter();
  const tracks = useLibraryStore((s) => s.tracks);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const permission = useLibraryStore((s) => s.permission);
  const error = useLibraryStore((s) => s.error);
  const searchQuery = useLibraryStore((s) => s.searchQuery);
  const setSearchQuery = useLibraryStore((s) => s.setSearchQuery);
  const loadTracks = useLibraryStore((s) => s.loadTracks);
  const refreshTracks = useLibraryStore((s) => s.refreshTracks);
  const requestAccess = useLibraryStore((s) => s.requestAccess);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingDeck, setLoadingDeck] = useState<string | null>(null);
  const loadTrack = useDeckStore((s) => s.loadTrack);
  const trackA = useDeckStore((s) => s.deckA.loadedTrack);
  const trackB = useDeckStore((s) => s.deckB.loadedTrack);

  useFocusEffect(useCallback(() => {
    void loadTracks(); // Checks permission; never opens the permission dialog.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadTracks();
    });
    return () => subscription.remove();
  }, [loadTracks]));
  const query = useDeferredValue(searchQuery.trim().toLocaleLowerCase());
  const filteredTracks = useMemo(() => tracks.filter((track) =>
    `${track.title} ${track.artist} ${track.album ?? ''}`.toLocaleLowerCase().includes(query)
  ), [tracks, query]);

  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleLoad = async (track: Track, deckId: 'A' | 'B') => {
    if (loadingDeck) return;
    setLoadingDeck(deckId);
    setLoadError(null);
    try {
      await loadTrack(deckId, track); // Metadata selection only; no play call.
      router.dismissTo('/');
    } catch {
      setLoadError(`Could not load ${track.title}. Please try again.`);
    } finally {
      setLoadingDeck(null);
    }
  };

  const renderTrackItem = ({ item }: { item: Track }) => {
    const isLoadedOnA = trackA?.id === item.id;
    const isLoadedOnB = trackB?.id === item.id;

    return (
      <View
        style={[
          styles.trackCard,
          isLoadedOnA && styles.loadedOnACard,
          isLoadedOnB && styles.loadedOnBCard,
        ]}>
        <View style={styles.trackMain}>
          <View style={styles.artworkPlaceholder}>
            <TrackArtwork uri={item.artworkUrl} />
          </View>

          <View style={styles.textColumn}>
            <View style={styles.titleRow}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {isLoadedOnA && (
                <View style={[styles.deckStatusTag, { backgroundColor: DJColors.deckADark, borderColor: DJColors.deckA }]}>
                  <Text style={[styles.deckStatusText, { color: DJColors.deckA }]}>DECK A</Text>
                </View>
              )}
              {isLoadedOnB && (
                <View style={[styles.deckStatusTag, { backgroundColor: DJColors.deckBDark, borderColor: DJColors.deckB }]}>
                  <Text style={[styles.deckStatusText, { color: DJColors.deckB }]}>DECK B</Text>
                </View>
              )}
            </View>

            <Text style={styles.trackArtist} numberOfLines={1}>
              {item.artist}{item.album ? ` • ${item.album}` : ''}
            </Text>

            <View style={styles.badgesRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeLabel}>BPM</Text>
                <Text style={styles.badgeValue}>{item.bpm > 0 ? item.bpm.toFixed(1) : '--'}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeLabel}>KEY</Text>
                <Text style={styles.badgeValue}>{item.musicalKey}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeLabel}>LEN</Text>
                <Text style={styles.badgeValue}>{formatDuration(item.duration)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TactileButton
            label="LOAD A"
            disabled={loadingDeck !== null}
            variant="deckA"
            size="small"
            isActive={isLoadedOnA}
            onPress={() => handleLoad(item, 'A')}
            style={styles.loadBtn}
            accessibilityLabel={`Load ${item.title} into Deck A`}
          />
          <TactileButton
            label="LOAD B"
            disabled={loadingDeck !== null}
            variant="deckB"
            size="small"
            isActive={isLoadedOnB}
            onPress={() => handleLoad(item, 'B')}
            style={styles.loadBtn}
            accessibilityLabel={`Load ${item.title} into Deck B`}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>MUSIC CRATE LIBRARY</Text>
            <Text style={styles.headerSub}>{filteredTracks.length} TRACKS AVAILABLE</Text>
          </View>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.dismissTo('/')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Back to Mixer">
            <Ionicons name="close" size={20} color={DJColors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color={DJColors.textMuted} style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search tracks, artists, albums..."
            accessibilityLabel="Search local music"
            placeholderTextColor={DJColors.textMuted}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={DJColors.textMuted} />
            </Pressable>
          )}
        </View>

        <View style={styles.libraryToolbar}>
          <Text style={styles.headerSub}>LOCAL DEVICE MUSIC</Text>
          <TactileButton label="REFRESH" size="small" onPress={() => { void refreshTracks(); }} disabled={isLoading} />
        </View>
      </View>

      {(error || loadError) && <Text accessibilityRole="alert" style={styles.stateMessage}>{loadError ?? error}</Text>}
      <FlatList
        data={permission === 'granted' ? filteredTracks : []}
        keyExtractor={(item) => item.id}
        renderItem={renderTrackItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        refreshing={isLoading && tracks.length > 0}
        onRefresh={() => { void refreshTracks(); }}
        ListEmptyComponent={<View style={styles.emptyState}>
          {isLoading ? <><ActivityIndicator color={DJColors.deckA} /><Text style={styles.stateMessage}>Reading device music…</Text></>
            : permission === 'unavailable' ? <Text style={styles.stateMessage}>Open the installed Remixer Android app to access music on this device.</Text>
            : permission !== 'granted' ? <>
              <Text style={styles.stateMessage}>Remixer needs access to audio files on this device to build your music library.</Text>
              {permission === 'blocked' && <Text style={styles.stateMessage}>Music access is disabled. You can enable it in app settings.</Text>}
              <TactileButton label={permission === 'blocked' ? 'OPEN SETTINGS' : 'Allow Music Access'}
                onPress={() => { if (permission === 'blocked') void Linking.openSettings().catch(() => setLoadError('Could not open settings. Open Remixer permissions from Android Settings.')); else void requestAccess(); }} />
            </> : <>
              <Text style={styles.stateMessage}>{error ? 'Your library could not be read.' : tracks.length === 0 ? 'No local audio files found. Add music to your device, then refresh.' : 'No tracks match your search.'}</Text>
              <TactileButton label="TRY AGAIN" onPress={() => { void refreshTracks(); }} />
            </>}
        </View>}
      />

      <BottomNavBar />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  libraryToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyState: { alignItems: 'center', padding: 24, gap: 12 },
  stateMessage: { color: DJColors.textSecondary, textAlign: 'center', padding: 12 },
  safeArea: {
    flex: 1,
    backgroundColor: DJColors.chassis,
  },
  header: {
    backgroundColor: DJColors.surface,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: DJColors.borderSubtle,
    gap: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: DJFonts.condensed,
    fontSize: 16,
    fontWeight: '900',
    color: DJColors.textPrimary,
    letterSpacing: 1.0,
  },
  headerSub: {
    fontFamily: DJFonts.mono,
    fontSize: 8.5,
    color: DJColors.textMuted,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: DJColors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DJColors.surfaceInset,
    borderRadius: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
    height: 38,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: DJColors.textPrimary,
    fontFamily: DJFonts.display,
    fontSize: 13,
  },
  genreList: {
    gap: 6,
    paddingVertical: 2,
  },
  genrePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 3,
    backgroundColor: DJColors.surfaceRaised,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
  },
  genrePillActive: {
    borderColor: DJColors.deckA,
    backgroundColor: DJColors.deckADark,
  },
  genrePillText: {
    fontFamily: DJFonts.condensed,
    fontSize: 10,
    fontWeight: '700',
    color: DJColors.textSecondary,
    letterSpacing: 0.5,
  },
  genrePillTextActive: {
    color: DJColors.deckA,
  },
  listContent: {
    padding: 10,
    gap: 8,
  },
  trackCard: {
    backgroundColor: DJColors.surface,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
    gap: 8,
  },
  loadedOnACard: {
    borderColor: 'rgba(0,229,255,0.4)',
  },
  loadedOnBCard: {
    borderColor: 'rgba(255,145,0,0.4)',
  },
  trackMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  artworkPlaceholder: {
    width: 44,
    height: 44,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: DJColors.surfaceInset,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DJColors.borderSubtle,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  trackTitle: {
    fontFamily: DJFonts.condensed,
    fontSize: 13,
    fontWeight: '800',
    color: DJColors.textPrimary,
    flex: 1,
  },
  deckStatusTag: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 1,
  },
  deckStatusText: {
    fontFamily: DJFonts.condensed,
    fontSize: 8.5,
    fontWeight: '900',
  },
  trackArtist: {
    fontFamily: DJFonts.display,
    fontSize: 11,
    color: DJColors.textSecondary,
    marginTop: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    backgroundColor: DJColors.surfaceInset,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  badgeLabel: {
    fontFamily: DJFonts.mono,
    fontSize: 7.5,
    fontWeight: '700',
    color: DJColors.textMuted,
  },
  badgeValue: {
    fontFamily: DJFonts.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: DJColors.textPrimary,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: DJColors.borderSubtle,
    paddingTop: 6,
  },
  loadBtn: {
    minHeight: 28,
    paddingHorizontal: 12,
  },
});
