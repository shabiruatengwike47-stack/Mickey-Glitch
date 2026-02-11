const axios = require('axios');

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url || !url.includes('facebook.com')) {
            return await sock.sendMessage(chatId, { text: '❌ Weka link ya Facebook. Mfano: .fb https://fb.watch/xyz' }, { quoted: message });
        }

        // React kuonyesha bot inafanyia kazi link
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        
        const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/fbdl?url=${encodeURIComponent(url)}`;
        
        const res = await axios.get(apiUrl, { timeout: 25000 });
        const data = res.data;

        if (!data.status || !data.data || !data.data.high) {
            return await sock.sendMessage(chatId, { text: '❌ API haijapata data za video hii.' }, { quoted: message });
        }

        const videoData = data.data;
        const title = videoData.title || "Facebook Video";
        const videoUrl = videoData.high || videoData.low;

        if (!videoUrl) {
            return await sock.sendMessage(chatId, { text: '❌ Imeshindwa kupata link ya kupakua.' }, { quoted: message });
        }

        // React kuonyesha ufunguaji wa file umeanza
        await sock.sendMessage(chatId, { react: { text: '📥', key: message.key } });

        // 3. Tuma video moja kwa moja
        await sock.sendMessage(chatId, { 
            video: { url: videoUrl }, 
            mimetype: 'video/mp4', 
            caption: `✅ *Facebook HD Downloader*\n\n*Title:* ${title}\n*Thumbnail:* ${videoData.thumbnail}`,
            fileName: `${title}.mp4`
        }, { quoted: message });

        // React kuonyesha imekamilika
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('FB Direct Error:', error);
        await sock.sendMessage(chatId, { text: `❌ Hitilafu: Video ni kubwa sana au link imekufa.` });
    }
}

module.exports = facebookCommand;
