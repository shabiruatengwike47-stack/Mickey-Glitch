const axios = require('axios');
const yts = require('yt-search');

/**
 * SONG COMMAND - DUAL API SYSTEM
 * Inatumia API mbili (Aswin Sparky & Srihub) kuhakikisha wimbo unapatikana.
 */
async function songCommand(sock, chatId, message) {
    const textBody = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = textBody.split(" ").slice(1).join(" ");

    if (!query) {
        return sock.sendMessage(chatId, { text: '❌ *Tafadhali andika jina la wimbo!*' }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { react: { text: '🔎', key: message.key } });

        // 1. Tafuta video YouTube
        const search = await yts(query);
        const video = search.videos[0];

        if (!video) {
            return sock.sendMessage(chatId, { text: '❌ *Wimbo haujapatikana YouTube.*' }, { quoted: message });
        }

        const videoUrl = video.url;
        const videoTitle = video.title;

        await sock.sendMessage(chatId, { text: `🎵 *Wimbo:* ${videoTitle}\n⏳ _Inatafuta seva bora, tafadhali subiri..._` }, { quoted: message });

        // 2. API MBILI ZINAZOPIGA KAZI
        const apiKey = "dew_SHmZ6Kcc67WTZqLfC3GGC774gANCHhtfIudTPQak";
        const DOWNLOAD_APIS = [
            `https://api-aswin-sparky.koyeb.app/api/downloader/song?search=${encodeURIComponent(videoUrl)}`, // API ya sasa
            `https://api.srihub.store/download/ytmp3?url=${encodeURIComponent(videoUrl)}&apikey=${apiKey}`  // API mbadala
        ];

        let downloadUrl = null;

        // 3. Jaribu API ya kwanza, ikifeli nenda ya pili
        for (const api of DOWNLOAD_APIS) {
            try {
                const response = await axios.get(api, { timeout: 40000 });
                const resData = response.data;

                // Kuchuja link kulingana na muundo wa kila API
                downloadUrl = resData.data?.url || resData.result?.download_url || resData.url;

                if (downloadUrl && downloadUrl.startsWith('http')) {
                    console.log(`✅ Seva imefanikiwa: ${api.split('/')[2]}`);
                    break; 
                }
            } catch (err) {
                console.log(`⚠️ Seva imegoma, inajaribu seva inayofuata...`);
                continue; 
            }
        }

        // 4. Tuma Audio
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
                            body: `Muda: ${video.timestamp} | Loft Quantum`,
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
            await sock.sendMessage(chatId, { text: '❌ *Samahani, seva zote ziko bize. Jaribu tena baadae.*' }, { quoted: message });
        }

    } catch (error) {
        console.error('Error:', error);
        await sock.sendMessage(chatId, { text: '❌ *Hitilafu ya mfumo imetokea.*' }, { quoted: message });
    }
}

module.exports = songCommand;
