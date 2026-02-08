const axios = require('axios');
const yts = require('yt-search');

/**
 * SONG COMMAND - HIGH SPEED EDITION
 * Imeboreshwa: Maandishi yameondolewa, Speed imeongezwa (Concurrent Fetching).
 */
async function songCommand(sock, chatId, message) {
    const textBody = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = textBody.split(" ").slice(1).join(" ");

    if (!query) {
        return sock.sendMessage(chatId, { text: '❌ *Tafadhali andika jina la wimbo!*' }, { quoted: message });
    }

    try {
        // Reaction kuanza utafutaji
        await sock.sendMessage(chatId, { react: { text: '🔎', key: message.key } });

        const search = await yts(query);
        const video = search.videos[0];

        if (!video) {
            return sock.sendMessage(chatId, { text: '❌ *Wimbo haujapatikana.*' }, { quoted: message });
        }

        const videoUrl = video.url;
        const videoTitle = video.title;

        // API Configuration
        const apiKey = "dew_SHmZ6Kcc67WTZqLfC3GGC774gANCHhtfIudTPQak";
        const endpoints = [
            `https://api-aswin-sparky.koyeb.app/api/downloader/song?search=${encodeURIComponent(videoUrl)}`,
            `https://api.srihub.store/download/ytmp3?url=${encodeURIComponent(videoUrl)}&apikey=${apiKey}`
        ];

        // SPEED OPTIMIZATION: Tunatuma maombi kwenye API zote mbili kwa pamoja
        // Ile itakayowahi kutoa jibu (First Response) ndiyo inatumika.
        const fetchDownloadUrl = async (url) => {
            const res = await axios.get(url, { timeout: 20000 });
            const link = res.data?.data?.url || res.data?.result?.download_url || res.data?.url;
            if (link && link.startsWith('http')) return link;
            throw new Error('Invalid Link');
        };

        let downloadUrl;
        try {
            // Inajaribu API zote kwa mpigo kuongeza speed
            downloadUrl = await Promise.any(endpoints.map(url => fetchDownloadUrl(url)));
        } catch (e) {
            // Fallback: Kama Promise.any ikifeli (API zote zikigoma)
            downloadUrl = null;
        }

        if (downloadUrl) {
            await sock.sendMessage(chatId, { react: { text: '📥', key: message.key } });

            await sock.sendMessage(
                chatId,
                {
                    audio: { url: downloadUrl },
                    mimetype: 'audio/mpeg',
                    fileName: `${videoTitle}.mp3`,
                    contextInfo: {
                        externalAdReply: {
                            title: videoTitle,
                            body: `Mickey Glitch Music Player • ${video.timestamp}`,
                            thumbnailUrl: video.thumbnail,
                            sourceUrl: videoUrl,
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    }
                },
                { quoted: message }
            );

            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        } else {
            await sock.sendMessage(chatId, { text: '❌ *Seva zimeshindwa kupata wimbo huu kwa sasa.*' }, { quoted: message });
        }

    } catch (error) {
        console.error('Error:', error);
        await sock.sendMessage(chatId, { text: '❌ *Hitilafu imetokea.*' }, { quoted: message });
    }
}

module.exports = songCommand;
