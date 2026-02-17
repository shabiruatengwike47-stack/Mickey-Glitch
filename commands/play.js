const axios = require('axios');
const yts = require('yt-search');

async function songCommand(sock, chatId, message) {
    const textBody = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = textBody.split(" ").slice(1).join(" ");

    if (!query) return sock.sendMessage(chatId, { text: '🎵 *Andika jina la wimbo!*' });

    try {
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const { videos } = await yts(query);
        if (!videos.length) return sock.sendMessage(chatId, { text: '❌ *Haupatikani!*' });

        const vid = videos[0];
        
        // Short Informational Text
        const cap = `✨ *${vid.title}*\n⏱️ ${vid.timestamp} | 📥 _Inapakua..._`;
        await sock.sendMessage(chatId, { text: cap }, { quoted: message });

        const DOWNLOAD_APIS = [
            `https://api-aswin-sparky.koyeb.app/api/downloader/song?search=${encodeURIComponent(vid.url)}`,
            `https://api.srihub.store/download/ytmp3?url=${encodeURIComponent(vid.url)}&apikey=dew_SHmZ6Kcc67WTZqLfC3GGC774gANCHhtfIudTPQak`
        ];

        let dlUrl = null;
        for (const api of DOWNLOAD_APIS) {
            try {
                const res = await axios.get(api, { timeout: 35000 });
                dlUrl = res.data.data?.url || res.data.result?.download_url || res.data.url;
                if (dlUrl) break;
            } catch { continue; }
        }

        if (dlUrl) {
            // Hapa bot inaonyesha "Recording..." status
            await sock.sendPresenceUpdate('recording', chatId);

            await sock.sendMessage(chatId, {
                audio: { url: dlUrl },
                mimetype: 'audio/mpeg',
                fileName: `${vid.title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: vid.title,
                        body: `Imeandaliwa kwa Upendo • ${vid.timestamp}`,
                        thumbnailUrl: vid.thumbnail,
                        sourceUrl: vid.url,
                        mediaType: 1,
                        showAdAttribution: true, // Ad Banner Look
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: message });

            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        } else {
            await sock.sendMessage(chatId, { text: '❌ *Seva zote zimekataa!*' });
        }
    } catch (e) {
        await sock.sendMessage(chatId, { text: '🚨 *Hitilafu imetokea!*' });
    } finally {
        // Zima status ya kurekodi ikimaliza
        await sock.sendPresenceUpdate('paused', chatId);
    }
}

module.exports = songCommand;
