const axios = require('axios');
const yts = require('yt-search');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

async function getYupraVideoByUrl(youtubeUrl) {
    const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/ytv?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.status && res?.data?.data?.url) {
        return {
            download: res.data.data.url,
            title: res.data.data.title,
            thumbnail: res.data.data.thumbnail
        };
    }
    throw new Error('Yupra returned no download');
}

async function getOkatsuVideoByUrl(youtubeUrl) {
    const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/ytv?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    // shape: { status, creator, data: { title, url } }
    if (res?.data?.status && res?.data?.data?.url) {
        return { download: res.data.data.url, title: res.data.data.title };
    }
    throw new Error('Okatsu ytmp4 returned no url');
}

async function getHansaVideoByUrl(youtubeUrl) {
    const apiUrl = `https://api.srihub.store/download/ytmp4?url=${encodeURIComponent(youtubeUrl)}&apikey=dew_DVTcyMksTDO8ZGxBvLAG0y9P8sIj6uRJXHHwWSW5`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    // shape: { success, result: { title, thumbnail, download_url, quality } }
    if (res?.data?.success && res?.data?.result?.download_url) {
        return {
            download: res.data.result.download_url,
            title: res.data.result.title,
            thumbnail: res.data.result.thumbnail,
            quality: res.data.result.quality
        };
    }
    throw new Error('Hansa returned no download_url');
}

async function videoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const searchQuery = text.split(' ').slice(1).join(' ').trim();


        if (!searchQuery) {
            await sock.sendMessage(chatId, { text: 'What video do you want to download?' }, { quoted: message });
            return;
        }

        // Determine if input is a YouTube link
        let videoUrl = '';
        let videoTitle = '';
        let videoThumbnail = '';
        if (searchQuery.startsWith('http://') || searchQuery.startsWith('https://')) {
            videoUrl = searchQuery;
        } else {
            // Search YouTube for the video
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                await sock.sendMessage(chatId, { text: 'No videos found!' }, { quoted: message });
                return;
            }
            videoUrl = videos[0].url;
            videoTitle = videos[0].title;
            videoThumbnail = videos[0].thumbnail;
        }

        // Send thumbnail immediately
        try {
            const ytId = (videoUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/) || [])[1];
            const thumb = videoThumbnail || (ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : undefined);
            const captionTitle = videoTitle || searchQuery;
            if (thumb) {
                await sock.sendMessage(chatId, {
                    image: { url: thumb },
                    caption: `*${captionTitle}*\nDownloading...`
                }, { quoted: message });
            }
        } catch (e) { console.error('[VIDEO] thumb error:', e?.message || e); }


        // Validate YouTube URL
        let urls = videoUrl.match(/(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/|playlist\?list=)?)([a-zA-Z0-9_-]{11})/gi);
        if (!urls) {
            await sock.sendMessage(chatId, { text: 'This is not a valid YouTube link!' }, { quoted: message });
            return;
        }

        // Get video: try Yupra first, then Okatsu, then Hansa as fallback
        let videoData;
        try {
            videoData = await getYupraVideoByUrl(videoUrl);
        } catch (e1) {
            try {
                videoData = await getOkatsuVideoByUrl(videoUrl);
            } catch (e2) {
                videoData = await getHansaVideoByUrl(videoUrl);
            }
        }

        // Send video directly using the download URL
        await sock.sendMessage(chatId, {
            video: { url: videoData.download },
            mimetype: 'video/mp4',
            fileName: `${videoData.title || videoTitle || 'video'}.mp4`,
            caption: `*${videoData.title || videoTitle || 'Video'}*\n\n> *Mickey Glitch*`
        }, { quoted: message });


    } catch (error) {
        console.error('[VIDEO] Command Error:', error?.message || error);
        await sock.sendMessage(chatId, { text: 'Download failed: ' + (error?.message || 'Unknown error') }, { quoted: message });
    }
}

module.exports = videoCommand; 
