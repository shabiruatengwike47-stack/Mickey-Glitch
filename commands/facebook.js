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

        const apiKey = "dew_SHmZ6Kcc67WTZqLfC3GGC774gANCHhtfIudTPQak";
        const apiUrl = `https://api.srihub.store/download/facebook?url=${encodeURIComponent(url)}&apikey=${apiKey}`;
        
        const res = await axios.get(apiUrl, { timeout: 25000 });
        const data = res.data;

        if (!data.success || !data.result || !data.result.result) {
            return await sock.sendMessage(chatId, { text: '❌ API haijapata data za video hii.' }, { quoted: message });
        }

        const videoInfo = data.result;
        const videoList = data.result.result; 
        const title = videoInfo.title || "Facebook Video";

        // 1. Tafuta video ya 720p (HD) kwanza
        let selectedVideo = videoList.find(v => v.quality.includes("720p") || v.quality.includes("HD"));

        // 2. Kama 720p haipo, chukua video yoyote ya kwanza iliyopo (kawaida ni SD)
        if (!selectedVideo) {
            selectedVideo = videoList[0];
        }

        if (!selectedVideo || !selectedVideo.url) {
            return await sock.sendMessage(chatId, { text: '❌ Imeshindwa kupata link ya kupakua.' }, { quoted: message });
        }

        // React kuonyesha ufunguaji wa file umeanza
        await sock.sendMessage(chatId, { react: { text: '📥', key: message.key } });

        // 3. Tuma video moja kwa moja
        await sock.sendMessage(chatId, { 
            video: { url: selectedVideo.url }, 
            mimetype: 'video/mp4', 
            caption: `✅ *Facebook HD Downloader*\n\n*Title:* ${title}\n*Quality:* ${selectedVideo.quality}`,
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
