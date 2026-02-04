const axios = require('axios');
const yts = require('yt-search');
const { getBuffer } = require("../lib/myfunc");
const logger = require("../lib/logger");

// Enhanced axios config with better headers and timeouts
const AXIOS_CONFIG = {
    timeout: 50000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.youtube.com/',
        'Accept-Language': 'en-US,en;q=0.9'
    },
    maxContentLength: 100 * 1024 * 1024,
    maxBodyLength: 100 * 1024 * 1024,
    validateStatus: (status) => status >= 200 && status < 400
};

// Multiple API endpoints with different response structures
const MP3_DOWNLOAD_APIS = [
    // Standard APIs
    url => `https://apis-malvin.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`,
    url => `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(url)}`,
    url => `https://apis.davidcyriltech.my.id/youtube/mp3?url=${encodeURIComponent(url)}`,
    url => `https://jawad-tech.vercel.app/download/ytmp3?url=${encodeURIComponent(url)}`,
    url => `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(url)}&format=mp3`,
    url => `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`,
    // Additional fallback APIs
    url => `https://www.yt-downloader.org/api/button/mp3/${encodeURIComponent(url)}`,
    url => `https://api.dmhm.top/api/youtube?url=${encodeURIComponent(url)}&type=audio`
];

/**
 * Extract download URL from various API response structures
 */
function extractDownloadUrl(data) {
    if (!data) return null;

    // Check common response patterns (in order of likelihood)
    const patterns = [
        // Nested result.download structures
        () => data.result?.download?.url || data.result?.download,
        // Direct download/audio/video fields
        () => data.download || data.dl || data.audio || data.video,
        // URL fields
        () => data.url || data.link || data.path,
        // Audio/video specific
        () => data.audioUrl || data.audio?.url || data.videoUrl || data.video?.url,
        // Mp3/mp4 specific
        () => data.mp3 || data.mp3url || data.mp4,
        // Media nested
        () => data.media?.url || data.media?.audio?.url,
        // Playable
        () => data.playable || data.playUrl,
        // Result variants
        () => data.result?.url || data.result?.media || data.result?.url,
        // Data variants
        () => data.data?.url || data.data?.download || data.data?.audio
    ];

    for (const pattern of patterns) {
        try {
            const url = pattern();
            if (url && typeof url === 'string' && url.startsWith('http')) {
                return url;
            }
        } catch (e) {
            // Pattern didn't work, try next
        }
    }

    return null;
}

/**
 * Extract title from various response structures
 */
function extractTitle(data, fallback = 'Audio') {
    if (!data) return fallback;
    
    const title = 
        data.title || 
        data.name || 
        data.song || 
        data.songName ||
        data.result?.title ||
        data.data?.title ||
        data.media?.title ||
        fallback;
    
    return (title || fallback).toString();
}

/**
 * Try to fetch with timeout and retry logic
 */
async function tryFetchWithTimeout(fetchFn, timeoutMs = 40000, retries = 2) {
    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await Promise.race([
                fetchFn(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
                )
            ]);
        } catch (err) {
            lastError = err;
            if (attempt < retries) {
                // Exponential backoff: 500ms, 1000ms
                await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
            }
        }
    }
    
    throw lastError || new Error('Request failed after retries');
}

/**
 * Main function to get audio link from YouTube video
 * Tries multiple APIs with different response formats
 */
async function tryGetAudioLink(videoUrl, titleForQuery = '') {
    const errors = [];
    let lastDownloadUrl = null;

    logger.info('🎵', `Attempting to download audio from: ${videoUrl.substring(0, 50)}...`);

    for (let apiIndex = 0; apiIndex < MP3_DOWNLOAD_APIS.length; apiIndex++) {
        const apiFn = MP3_DOWNLOAD_APIS[apiIndex];
        const apiUrl = apiFn(videoUrl);
        const apiName = new URL(apiUrl).hostname;

        try {
            logger.debug('🔗', `Trying API ${apiIndex + 1}/${MP3_DOWNLOAD_APIS.length}: ${apiName}`);

            const res = await tryFetchWithTimeout(() =>
                axios.get(apiUrl, AXIOS_CONFIG),
                40000,
                1
            );

            if (!res || !res.data) {
                throw new Error('Empty response from API');
            }

            const data = res.data;

            // Try to extract download URL with enhanced extraction logic
            const downloadUrl = extractDownloadUrl(data);

            if (!downloadUrl) {
                logger.warning('⚠️', `API ${apiName} returned data but no valid download URL found`);
                errors.push({
                    api: apiName,
                    error: 'No download URL in response'
                });
                await new Promise(r => setTimeout(r, 600));
                continue;
            }

            // Validate the download URL is actually accessible
            try {
                const headRes = await axios.head(downloadUrl, {
                    ...AXIOS_CONFIG,
                    timeout: 5000,
                    maxRedirects: 3
                });
                
                if (headRes.status >= 200 && headRes.status < 400) {
                    logger.success('✅', `Downloaded from ${apiName}`);
                    lastDownloadUrl = downloadUrl;
                    
                    return {
                        downloadUrl,
                        title: extractTitle(data, titleForQuery),
                        thumbnail: data.thumb || data.thumbnail || null
                    };
                }
            } catch (validateErr) {
                logger.warning('⚠️', `Download URL from ${apiName} is not accessible`);
                errors.push({
                    api: apiName,
                    error: 'URL validation failed: ' + validateErr.message
                });
                await new Promise(r => setTimeout(r, 600));
                continue;
            }

        } catch (err) {
            const errorMsg = err.message || err.toString();
            logger.warning('⚠️', `API ${apiName} failed: ${errorMsg.substring(0, 50)}`);
            
            errors.push({
                api: apiName,
                error: errorMsg
            });

            // Delay between attempts to avoid rate-limiting
            if (apiIndex < MP3_DOWNLOAD_APIS.length - 1) {
                await new Promise(r => setTimeout(r, 700));
            }
        }
    }

    // If we got this far, all APIs failed
    const lastErrorMsg = errors[errors.length - 1]?.error || 'Unknown error';
    const failedApis = errors.map(e => e.api).join(', ');
    
    logger.error('❌', `All ${MP3_DOWNLOAD_APIS.length} APIs failed`);
    logger.debug('📋', `Failed APIs: ${failedApis}`);
    
    throw new Error(`All APIs failed. Last error: ${lastErrorMsg}`);
}

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = text.split(' ').slice(1).join(' ').trim();

        if (!query) {
            logger.warning('📝', 'No query provided for .play command');
            await sock.sendMessage(chatId, { text: '⚠️ Usage: .play <song name or YouTube link>' }, { quoted: message });
            return;
        }

        logger.info('🎵', `Play request: "${query}"`);

        await sock.sendMessage(chatId, {
            react: { text: "🔍", key: message.key }
        });

        let videoInfo;
        let isDirectLink = false;

        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            logger.info('🔗', 'Direct YouTube link provided');
            isDirectLink = true;
            videoInfo = {
                url: query,
                title: 'YouTube Link',
                thumbnail: 'https://i.ytimg.com/vi_webp/default.jpg',
                timestamp: '?'
            };
        } else {
            logger.info('🔎', `Searching for: "${query}"`);
            
            await sock.sendMessage(chatId, {
                react: { text: "🔎", key: message.key }
            });

            try {
                const search = await yts(query);
                if (!search.videos?.length) {
                    logger.warning('📭', `No search results for: ${query}`);
                    await sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
                    await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
                    return;
                }

                videoInfo = search.videos[0];
                logger.info('✅', `Found: "${videoInfo.title}"`);
            } catch (searchErr) {
                logger.error('❌', `Search failed: ${searchErr.message}`);
                throw new Error('Failed to search YouTube. Please try again.');
            }
        }

        await sock.sendMessage(chatId, {
            react: { text: "⬇️", key: message.key }
        });

        // Get thumbnail
        let thumbnailBuffer;
        try {
            logger.debug('🖼️', `Fetching thumbnail: ${videoInfo.thumbnail.substring(0, 40)}...`);
            thumbnailBuffer = await getBuffer(videoInfo.thumbnail);
        } catch {
            logger.warning('⚠️', 'Failed to fetch thumbnail, using default');
            try {
                thumbnailBuffer = await getBuffer("https://i.ytimg.com/vi_webp/default.jpg");
            } catch {
                thumbnailBuffer = null;
            }
        }

        // Beautiful preview
        logger.info('📢', 'Sending preview message');
        await sock.sendMessage(chatId, {
            text: "🎵 *Preparing your song...*",
            contextInfo: {
                externalAdReply: {
                    title: videoInfo.title || "Unknown Title",
                    body: `Duration: ${videoInfo.timestamp || '?'} • Requested by Mickey Glitch™`,
                    thumbnail: thumbnailBuffer || undefined,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    sourceUrl: videoInfo.url || "https://youtube.com"
                }
            }
        }, { quoted: message });

        // ─── Main download logic ────────────────────────────────
        logger.info('⏳', 'Starting audio download...');
        const audioInfo = await tryGetAudioLink(videoInfo.url, videoInfo.title);

        if (!audioInfo?.downloadUrl) {
            logger.error('❌', 'No valid download URL obtained');
            throw new Error("Could not find any working download link");
        }

        logger.info('🎵', `Sending audio file: "${audioInfo.title}"`);

        await sock.sendMessage(chatId, {
            react: { text: "🎵", key: message.key }
        });

        // Send audio with proper formatting
        const audioFileName = (audioInfo.title || videoInfo.title || 'song')
            .replace(/[^\w\s-]/g, '')
            .substring(0, 100) + '.mp3';

        try {
            await sock.sendMessage(chatId, {
                audio: { url: audioInfo.downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: audioFileName,
                ptt: false,
                waveform: [5,18,35,55,78,95,82,60,38,20,8,0]
            }, { quoted: message });
            
            logger.success('✅', `Audio sent successfully: "${audioFileName}"`);
        } catch (sendErr) {
            logger.error('❌', `Failed to send audio: ${sendErr.message}`);
            // Try alternative method
            logger.info('↩️', 'Attempting alternative send method...');
            await sock.sendMessage(chatId, {
                document: { url: audioInfo.downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: audioFileName
            }, { quoted: message });
            logger.success('✅', 'Audio sent as document');
        }

        await sock.sendMessage(chatId, {
            react: { text: "✅", key: message.key }
        });

    } catch (err) {
        logger.error('❌', `Play command failed: ${err.message}`);

        let errorText = '❌ Failed to download the song.\nTry again later or use another song.';

        if (err.message.includes('All') && err.message.includes('failed')) {
            errorText = '❌ All download servers are currently down or blocked.\n\n💡 Try:\n• Using a different song\n• Waiting a few minutes\n• Check your internet connection';
        } else if (err.message.includes('timeout')) {
            errorText = '⏱️ Request timed out. The song might be too long or servers are slow.\n\nTry again with a shorter song.';
        }

        try {
            await sock.sendMessage(chatId, { text: errorText }, { quoted: message });
            await sock.sendMessage(chatId, {
                react: { text: "❌", key: message.key }
            });
        } catch (msgErr) {
            logger.error('❌', `Failed to send error message: ${msgErr.message}`);
        }
    }
}

module.exports = playCommand;