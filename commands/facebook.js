const axios = require('axios');
const { prepareWAMessageMedia, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const url = text.split(' ').slice(1).join(' ').trim();

        if (!url || !url.includes('facebook.com')) {
            return await sock.sendMessage(chatId, { text: '❌ Tafadhali weka link ya Facebook.\nMfano: .fb https://www.facebook.com/video...' }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const apiKey = "dew_SHmZ6Kcc67WTZqLfC3GGC774gANCHhtfIudTPQak";
        const apiUrl = `https://api.srihub.store/download/facebook?url=${encodeURIComponent(url)}&apikey=${apiKey}`;
        
        const res = await axios.get(apiUrl);
        const data = res.data;

        if (!data.status || !data.result) {
            return await sock.sendMessage(chatId, { text: '❌ Imefeli kupata video. Hakikisha link ni sahihi.' }, { quoted: message });
        }

        const result = data.result;
        const title = result.title || "Facebook Video";
        const thumbnail = result.thumbnail || "https://i.imgur.com/Ou7969m.jpeg"; // Default image kama hakuna thumbnail
        
        // Tunatengeneza machaguo ya ubora (HD na SD)
        const qualities = [];
        if (result.media.video_hd) qualities.push({ label: 'High Quality (HD)', url: result.media.video_hd, id: 'hd' });
        if (result.media.video_sd) qualities.push({ label: 'Standard Quality (SD)', url: result.media.video_sd, id: 'sd' });

        if (qualities.length === 0) {
            return await sock.sendMessage(chatId, { text: '❌ Hakuna video inayoweza kupakuliwa.' }, { quoted: message });
        }

        const cards = [];

        for (const quality of qualities) {
            let media;
            try {
                media = await prepareWAMessageMedia(
                    { image: { url: thumbnail } },
                    { upload: sock.waUploadToServer }
                );
            } catch (e) { console.error("Media upload error", e); }

            cards.push({
                header: proto.Message.InteractiveMessage.Header.create({
                    ...(media || {}),
                    title: `*${quality.label}*`,
                    hasMediaAttachment: !!media,
                }),
                body: { text: `Bonyeza kitufe hapa chini kupakua video katika ubora wa ${quality.label}` },
                footer: { text: "Loft Quantum Downloader" },
                nativeFlowMessage: {
                    buttons: [
                        {
                            name: "quick_reply",
                            buttonParamsJson: JSON.stringify({
                                display_text: `Pakua ${quality.id.toUpperCase()}`,
                                id: `dl_fb_${quality.id}`
                            })
                        }
                    ]
                }
            });
        }

        const carouselMessage = generateWAMessageFromContent(
            chatId,
            {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: {
                            body: { text: `🎬 *${title}*\n\nChagua ubora wa video unayotaka kupakua kwenye kadi hizi:` },
                            carouselMessage: { cards, messageVersion: 1 }
                        }
                    }
                }
            },
            { quoted: message }
        );

        const sent = await sock.relayMessage(chatId, carouselMessage.message, {
            messageId: carouselMessage.key.id
        });

        // LISTENER YA BUTTON
        const listener = async (m) => {
            const mek = m.messages[0];
            if (!mek.message) return;

            const buttonId = mek.message?.buttonsResponseMessage?.selectedButtonId || 
                           mek.message?.templateButtonReplyMessage?.selectedId || 
                           mek.message?.interactiveResponseMessage?.nativeFlowResponse?.paramsJson;

            if (!buttonId) return;

            const parsed = JSON.parse(buttonId);
            const selectedId = parsed.id;

            if (selectedId && selectedId.startsWith('dl_fb_')) {
                const type = selectedId.replace('dl_fb_', ''); // 'hd' au 'sd'
                const videoUrl = type === 'hd' ? result.media.video_hd : result.media.video_sd;

                await sock.sendMessage(chatId, { react: { text: '📥', key: mek.key } });
                
                await sock.sendMessage(chatId, { 
                    video: { url: videoUrl }, 
                    mimetype: 'video/mp4', 
                    caption: `✅ Hii hapa video yako ya Facebook (${type.toUpperCase()})\n\n🔥 *Title:* ${title}` 
                }, { quoted: mek });

                // Zima listener baada ya kazi kwisha
                sock.ev.off('messages.upsert', listener);
            }
        };

        sock.ev.on('messages.upsert', listener);

    } catch (error) {
        console.error('FB Error:', error);
        await sock.sendMessage(chatId, { text: '❌ Hitilafu imetokea kwenye mfumo.' });
    }
}

module.exports = facebookCommand;
