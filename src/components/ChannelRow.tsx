import React, { useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, ListRenderItem } from 'react-native';
import { Channel } from '../types/iptv';
import { TVChannelTile } from './TVChannelTile';

interface ChannelRowProps {
  /** The title of this category row */
  title: string;
  /** List of channels in this row */
  channels: Channel[];
  /** Callback for when a tile in this row is focused */
  onChannelFocused?: (channel: Channel) => void;
}

/**
 * `<ChannelRow />` displays a horizontal row of Netflix-style portrait film cards.
 * Mirrors the Netflix "row" pattern: a bold category title on the left,
 * followed by a horizontally-scrollable rail of poster cards.
 * Optimized for memory footprint on Smart TV devices.
 */
export const ChannelRow: React.FC<ChannelRowProps> = React.memo(({
  title,
  channels,
  onChannelFocused,
}) => {
  const handleTileFocused = useCallback(
    (channel: Channel) => {
      if (onChannelFocused) {
        onChannelFocused(channel);
      }
    },
    [onChannelFocused]
  );

  const renderChannelItem: ListRenderItem<Channel> = useCallback(
    ({ item }) => (
      <TVChannelTile
        channel={item}
        onTileFocused={handleTileFocused}
      />
    ),
    [handleTileFocused]
  );

  const keyExtractor = useCallback((item: Channel) => item.id, []);

  // Prevent rendering empty rows
  if (!channels || channels.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Category Header — Netflix bold white title */}
      <View style={styles.headerRow}>
        <Text style={styles.rowTitle}>{title}</Text>
        {channels.length > 0 && (
          <Text style={styles.rowCount}>{channels.length} channels</Text>
        )}
      </View>

      {/* Optimized Horizontal Rail */}
      <FlatList
        data={channels}
        renderItem={renderChannelItem}
        keyExtractor={keyExtractor}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        
        // Performance properties crucial for Smart TV memory constraints
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={6}
        updateCellsBatchingPeriod={50}
      />
    </View>
  );
});

ChannelRow.displayName = 'ChannelRow';

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginLeft: 16,
    marginBottom: 2,
  },
  rowTitle: {
    color: '#FFFFFF', // Netflix bright white
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  rowCount: {
    color: '#737373', // Netflix gray
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 10,
  },
  listContent: {
    paddingHorizontal: 10, // Align with title margin + tile headroom
  },
});
