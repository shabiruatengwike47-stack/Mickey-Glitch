/**
 * Group Metadata Cache with Rate Limiting
 * Prevents rate-limit errors by caching and throttling metadata requests
 */

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MIN_REQUEST_INTERVAL = 500; // 500ms between requests
const metadataCache = new Map();
let lastRequestTime = 0;

/**
 * Get group metadata with caching and rate limiting
 * @param {Object} sock - Socket instance
 * @param {string} chatId - Chat/Group ID
 * @param {boolean} forceRefresh - Force refresh cache
 * @returns {Promise<Object>} - Group metadata
 */
async function getGroupMetadataWithCache(sock, chatId, forceRefresh = false) {
    try {
        // Check cache first
        if (!forceRefresh && metadataCache.has(chatId)) {
            const cached = metadataCache.get(chatId);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                return cached.data;
            }
        }

        // Rate limiting: enforce minimum interval between requests
        const timeSinceLastRequest = Date.now() - lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
            await new Promise(resolve => 
                setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
            );
        }

        // Make the request
        lastRequestTime = Date.now();
        const metadata = await sock.groupMetadata(chatId);

        // Cache the result
        metadataCache.set(chatId, {
            data: metadata,
            timestamp: Date.now()
        });

        return metadata;

    } catch (error) {
        // If rate limited, return cached data if available
        if (error.message?.includes('rate-overlimit') || error.data === 429) {
            const cached = metadataCache.get(chatId);
            if (cached) {
                console.warn(`[Metadata] Rate limited, using cached data for ${chatId}`);
                return cached.data;
            }
            // If no cache, wait and retry once
            console.warn(`[Metadata] Rate limited, retrying after delay...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            try {
                lastRequestTime = Date.now();
                const metadata = await sock.groupMetadata(chatId);
                metadataCache.set(chatId, {
                    data: metadata,
                    timestamp: Date.now()
                });
                return metadata;
            } catch (retryError) {
                console.error(`[Metadata] Retry failed for ${chatId}:`, retryError.message);
                throw retryError;
            }
        }

        throw error;
    }
}

/**
 * Clear specific cache entry
 */
function clearMetadataCache(chatId) {
    metadataCache.delete(chatId);
}

/**
 * Clear all cache
 */
function clearAllMetadataCache() {
    metadataCache.clear();
}

/**
 * Get cache stats
 */
function getCacheStats() {
    return {
        cacheSize: metadataCache.size,
        lastRequestTime,
        cacheEntries: Array.from(metadataCache.keys())
    };
}

module.exports = {
    getGroupMetadataWithCache,
    clearMetadataCache,
    clearAllMetadataCache,
    getCacheStats
};
