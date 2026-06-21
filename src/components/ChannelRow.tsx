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
 * `<ChannelRow />` displays a horizontal grid of channels for a category.
 * Highly optimized for memory footprint on Smart TV devices.
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
      {/* Category Header */}
      <Text style={styles.rowTitle}>{title}</Text>

      {/* Optimized Horizontal List */}
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
    marginVertical: 12,
  },
  rowTitle: {
    color: '#F9FAFB', // Cool white
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 16,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 6, // Offset padding to align nicely with title margin considering tile margin of 10
  },
});
