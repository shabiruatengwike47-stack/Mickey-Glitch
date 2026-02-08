const axios = require('axios');
const yts = require('yt-search');

/**
 * SONG COMMAND - CLEAN & FAST VERSION
 * Imeondolewa ujumbe wa seva na Hossam Ramzy.
 */
async function songCommand(sock, chatId, message) {
    const textBody = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = textBody.split(" ").slice(1).join(" ");

    if (!query) {
        return sock.sendMessage(chatId, { text: '❌ *Tafadhali andika jina la wimbo!*' }, { quoted: message });
    }

    try {
        // Reaction ya kuanza
        await sock.sendMessage(chatId, { react: { text: '🔎', key: message.key } });

        const search = await yts(query);
        const video = search.videos[0];

        if (!video) {
            return sock.sendMessage(chatId, { text: '❌ *Wimbo haujapatikana YouTube.*' }, { quoted: message });
        }

        const videoUrl = video.url;
        const videoTitle = video.title;

        // Tuma ujumbe mfupi wa kuanza kupakua bila maneno mengi ya seva
        await sock.sendMessage(chatId, { text: `🎵 *Inapakua:* ${videoTitle}...` }, { quoted: message });

        const apiKey = "dew_SHmZ6Kcc67WTZqLfC3GGC774gANCHhtfIudTPQak";
        const DOWNLOAD_APIS = [
            `https://api-aswin-sparky.koyeb.app/api/downloader/song?search=${encodeURIComponent(videoUrl)}`,
            `https://api.srihub.store/download/ytmp3?url=${encodeURIComponent(videoUrl)}&apikey=${apiKey}`
        ];

        let downloadUrl = null;

        // Jaribu API kwa haraka
        for (const api of DOWNLOAD_APIS) {
            try {
                const response = await axios.get(api, { timeout: 15000 });
                const resData = response.data;
                downloadUrl = resData.data?.url || resData.result?.download_url || resData.url;
                if (downloadUrl && downloadUrl.startsWith('http')) break;
            } catch (err) {
                continue; 
            }
        }

        if (downloadUrl) {
            await sock.sendMessage(chatId, { react: { text: '📥', key: message.key } });

            // Muonekano wako wa awali (Standard professional audio message)
            await sock.sendMessage(
                chatId,
                {
                    audio: { url: downloadUrl },
                    mimetype: 'audio/mpeg',
                    fileName: `${videoTitle}.mp3`,
                    contextInfo: {
                        externalAdReply: {
                            title: videoTitle,
                            body: `Muda: ${video.timestamp}`,
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
            await sock.sendMessage(chatId, { text: '❌ *Samahani, seva zimefeli kupata wimbo huu.*' }, { quoted: message });
        }

    } catch (error) {
        console.error('Error:', error);
        await sock.sendMessage(chatId, { text: '❌ *Hitilafu imetokea.*' }, { quoted: message });
    }
}

module.exports = songCommand;
