import { Channel } from '../types/iptv';

export interface ParseProgress {
  /** The number of lines parsed so far */
  processedLines: number;
  /** Total lines in the M3U playlist */
  totalLines: number;
  /** The count of channels successfully mapped */
  channelCount: number;
}

/**
 * Parses an M3U playlist string asynchronously in non-blocking chunks.
 * This prevents ANR (App Not Responding) exceptions on lower-powered TV SoC chipsets.
 * 
 * @param m3uContent Raw playlist text content.
 * @param onProgress Periodic callback showing parsing metrics.
 * @param chunkSize Number of lines parsed before yielding to the JS event loop.
 */
export async function parseM3UAsync(
  m3uContent: string,
  onProgress?: (progress: ParseProgress) => void,
  chunkSize: number = 1000
): Promise<Channel[]> {
  // Split on either CRLF or LF
  const lines = m3uContent.split(/\r?\n/);
  const totalLines = lines.length;
  const channels: Channel[] = [];
  
  let currentIndex = 0;
  let channelIndex = 0;
  
  // Track parameters of the most recently parsed #EXTINF metadata row
  let activeMetadata: {
    name: string;
    group: string;
    logo?: string;
    tvgId?: string;
    tvgName?: string;
  } | null = null;

  // Extract key="value" properties from the #EXTINF header
  const extractAttributes = (metaString: string): Record<string, string> => {
    const attributes: Record<string, string> = {};
    const attributeRegex = /(\S+?)\s*=\s*"([^"]*?)"/g;
    let match;
    
    while ((match = attributeRegex.exec(metaString)) !== null) {
      if (match[1] && match[2] !== undefined) {
        attributes[match[1].toLowerCase()] = match[2];
      }
    }
    return attributes;
  };

  while (currentIndex < totalLines) {
    const chunkEnd = Math.min(currentIndex + chunkSize, totalLines);
    
    for (let i = currentIndex; i < chunkEnd; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        continue;
      }
      
      if (line.startsWith('#EXTINF:')) {
        // Locate channel name which sits after the last comma
        const lastCommaIndex = line.lastIndexOf(',');
        let metadataSegment = line;
        let displayName = 'Unknown Channel';
        
        if (lastCommaIndex !== -1) {
          metadataSegment = line.substring(0, lastCommaIndex);
          displayName = line.substring(lastCommaIndex + 1).trim();
        }
        
        const attributes = extractAttributes(metadataSegment);
        
        activeMetadata = {
          name: displayName,
          group: attributes['group-title'] || 'Other',
          logo: attributes['tvg-logo'] || attributes['logo'],
          tvgId: attributes['tvg-id'],
          tvgName: attributes['tvg-name'],
        };
      } else if (line.startsWith('#')) {
        // Reset state or ignore other #EXT headers (e.g. #EXTGRP, #EXTM3U)
        if (!line.startsWith('#EXTINF:')) {
          activeMetadata = null;
        }
      } else {
        // If it's a URL and we have active metadata, save it
        if (activeMetadata) {
          // Generate a stable unique key using hash function
          const rawUniqueKey = `${activeMetadata.name}_${channelIndex++}_${line}`;
          const channelId = generateFnv1aHash(rawUniqueKey);

          channels.push({
            id: channelId,
            name: activeMetadata.name,
            url: line,
            group: activeMetadata.group,
            logo: activeMetadata.logo,
            tvgId: activeMetadata.tvgId,
            tvgName: activeMetadata.tvgName,
          });
          
          activeMetadata = null;
        }
      }
    }
    
    currentIndex = chunkEnd;
    
    if (onProgress) {
      onProgress({
        processedLines: currentIndex,
        totalLines,
        channelCount: channels.length,
      });
    }
    
    // Non-blocking pause: defer to event loop to allow other tasks (D-Pad responsiveness, drawing)
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  
  return channels;
}

/**
 * Fast, non-cryptographic FNV-1a 32-bit hash generator for stable React-Native keys.
 */
function generateFnv1aHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // Integer multiplication: hash * 16777619
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0).toString(36);
}
