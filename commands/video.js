const axios = require('axios');
const yts = require('yt-search');
const logger = require('../lib/logger');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.youtube.com/',
        'Accept-Language': 'en-US,en;q=0.9'
    },
    validateStatus: (status) => status >= 200 && status < 400
};

// Multiple video download API endpoints with fallbacks
const VIDEO_DOWNLOAD_APIS = [
    // Yupra API
    {
        name: 'Yupra',
        url: (url) => `https://api-aswin-sparky.koyeb.app/api/downloader/ytv?url=${encodeURIComponent(url)}`,
        parser: (data) => {
            if (data?.success && data?.data?.download_url) {
                return {
                    download: data.data.download_url,
                    title: data.data.title,
                    thumbnail: data.data.thumbnail
                };
            }
            return null;
        }
    },
    // Okatsu API
    {
        name: 'Okatsu',
        url: (url) => `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(url)}`,
        parser: (data) => {
            if (data?.result?.mp4) {
                return {
                    download: data.result.mp4,
                    title: data.result.title
                };
            }
            return null;
        }
    },
    // Additional fallback APIs
    {
        name: 'Ryzen',
        url: (url) => `https://api.ryzendesu.vip/api/downloader/ytvideo?url=${encodeURIComponent(url)}`,
        parser: (data) => {
            if (data?.result?.url || data?.url) {
                return {
                    download: data.result?.url || data.url,
                    title: data.result?.title || data.title || 'Video'
                };
            }
            return null;
        }
    },
    {
        name: 'DavidCyril',
        url: (url) => `https://apis.davidcyriltech.my.id/youtube/video?url=${encodeURIComponent(url)}`,
        parser: (data) => {
            if (data?.dl) {
                return {
                    download: data.dl,
                    title: data.title || 'Video'
                };
            }
            return null;
        }
    }
];

/**
 * Try multiple video download APIs with fallback
 */
async function tryGetVideoLink(youtubeUrl, titleForQuery = '') {
    const errors = [];

    logger.info('🎬', `Attempting video download from: ${youtubeUrl.substring(0, 50)}...`);

    for (let apiIndex = 0; apiIndex < VIDEO_DOWNLOAD_APIS.length; apiIndex++) {
        const api = VIDEO_DOWNLOAD_APIS[apiIndex];
        const apiUrl = api.url(youtubeUrl);

        try {
            logger.debug('🔗', `Trying API ${apiIndex + 1}/${VIDEO_DOWNLOAD_APIS.length}: ${api.name}`);

            const res = await Promise.race([
                axios.get(apiUrl, AXIOS_DEFAULTS),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), 40000)
                )
            ]);

            if (!res || !res.data) {
                throw new Error('Empty response from API');
            }

            // Use API-specific parser
            const videoData = api.parser(res.data);

            if (videoData && videoData.download) {
                // Validate download URL
                try {
                    const headRes = await axios.head(videoData.download, {
                        ...AXIOS_DEFAULTS,
                        timeout: 5000,
                        maxRedirects: 3
                    });
                    
                    if (headRes.status >= 200 && headRes.status < 400) {
                        logger.success('✅', `Downloaded from ${api.name}`);
                        return videoData;
                    }
                } catch (validateErr) {
                    logger.warning('⚠️', `Download URL from ${api.name} is not accessible`);
                    errors.push({ api: api.name, error: 'URL validation failed' });
                    await new Promise(r => setTimeout(r, 600));
                    continue;
                }
            }

            logger.warning('⚠️', `${api.name} returned invalid response structure`);
            errors.push({ api: api.name, error: 'Invalid response structure' });

        } catch (err) {
            const errorMsg = err.message || err.toString();
            logger.warning('⚠️', `${api.name} failed: ${errorMsg.substring(0, 50)}`);
            errors.push({ api: api.name, error: errorMsg });

            if (apiIndex < VIDEO_DOWNLOAD_APIS.length - 1) {
                await new Promise(r => setTimeout(r, 700));
            }
        }
    }

    const failedApis = errors.map(e => e.api).join(', ');
    logger.error('❌', `All ${VIDEO_DOWNLOAD_APIS.length} APIs failed`);
    logger.debug('📋', `Failed APIs: ${failedApis}`);
    
    throw new Error(`All ${VIDEO_DOWNLOAD_APIS.length} video APIs failed`);
}
}
async function videoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();

        if (!searchQuery) {
            logger.warning('📝', 'No query provided for .video command');
            await sock.sendMessage(chatId, { text: '⚠️ Usage: .video <video name or YouTube link>' }, { quoted: message });
            return;
        }

        logger.info('🎬', `Video request: "${searchQuery}"`);

        // Determine if input is a YouTube link
        let videoUrl = '';
        let videoTitle = '';
        let videoThumbnail = '';
        
        if (searchQuery.startsWith('http://') || searchQuery.startsWith('https://')) {
            logger.info('🔗', 'Direct YouTube link provided');
            videoUrl = searchQuery;
        } else {
            logger.info('🔎', `Searching for: "${searchQuery}"`);
            try {
                const { videos } = await yts(searchQuery);
                if (!videos || videos.length === 0) {
                    logger.warning('📭', `No videos found for: ${searchQuery}`);
                    await sock.sendMessage(chatId, { text: 'No videos found!' }, { quoted: message });
                    return;
                }
                videoUrl = videos[0].url;
                videoTitle = videos[0].title;
                videoThumbnail = videos[0].thumbnail;
                logger.info('✅', `Found: "${videoTitle}"`);
            } catch (searchErr) {
                logger.error('❌', `Search failed: ${searchErr.message}`);
                throw new Error('Failed to search YouTube. Please try again.');
            }
        }

        // Send thumbnail immediately
        try {
            const ytId = (videoUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1];
            const thumb = videoThumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : undefined);
            const captionTitle = videoTitle || searchQuery;
            if (thumb) {
                logger.debug('🖼️', 'Sending thumbnail preview');
                await sock.sendMessage(chatId, {
                    image: { url: thumb },
                    caption: `*${captionTitle}*\n⏳ Downloading...`
                }, { quoted: message });
            }
        } catch (e) { 
            logger.warning('⚠️', `Thumbnail error: ${e?.message}`);
        }

        // Validate YouTube URL
        let urls = videoUrl.match(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([a-zA-Z0-9_-]{11})/gi);
        if (!urls) {
            logger.error('❌', 'Invalid YouTube URL');
            await sock.sendMessage(chatId, { text: '❌ This is not a valid YouTube link!' }, { quoted: message });
            return;
        }

        // Get video from APIs with fallback
        logger.info('⏳', 'Starting video download...');
        const videoData = await tryGetVideoLink(videoUrl, videoTitle);

        if (!videoData?.download) {
            logger.error('❌', 'No valid download URL obtained');
            throw new Error("Could not find any working download link");
        }

        logger.info('📹', `Sending video: "${videoData.title}"`);

        // Send video with proper formatting
        const videoFileName = (videoData.title || videoTitle || 'video')
            .replace(/[^\w\s-]/g, '')
            .substring(0, 100) + '.mp4';

        try {
            await sock.sendMessage(chatId, {
                video: { url: videoData.download },
                mimetype: 'video/mp4',
                fileName: videoFileName,
                caption: `*${videoData.title || videoTitle || 'Video'}*\n\n> *Mickey Glitch™*`
            }, { quoted: message });

            logger.success('✅', `Video sent successfully: "${videoFileName}"`);
        } catch (sendErr) {
            logger.error('❌', `Failed to send video: ${sendErr.message}`);
            // Try alternative method
            logger.info('↩️', 'Attempting alternative send method...');
            await sock.sendMessage(chatId, {
                document: { url: videoData.download },
                mimetype: 'video/mp4',
                fileName: videoFileName
            }, { quoted: message });
            logger.success('✅', 'Video sent as document');
        }

    } catch (error) {
        logger.error('❌', `Video command failed: ${error?.message}`);
        
        let errorMsg = '❌ Download failed. Try again later.';
        if (error?.message?.includes('All') && error?.message?.includes('failed')) {
            errorMsg = '❌ All download servers are currently down.\n\n💡 Try:\n• Using a different video\n• Waiting a few minutes\n• Check your internet connection';
        } else if (error?.message?.includes('timeout')) {
            errorMsg = '⏱️ Request timed out. The video might be too long or servers are slow.\n\nTry again with a shorter video.';
        }

        try {
            await sock.sendMessage(chatId, { text: errorMsg }, { quoted: message });
        } catch (msgErr) {
            logger.error('❌', `Failed to send error message: ${msgErr.message}`);
        }
    }
}

module.exports = videoCommand; 
