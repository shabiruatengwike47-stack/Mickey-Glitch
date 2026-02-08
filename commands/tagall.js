const isAdmin = require('../lib/isAdmin');  // Imebaki kama ulivyoelekeza

// Kazi ya kuondoa emoji
function stripEmoji(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}|\u{1F1E6}-\u{1F1FF}]/gu, '');
}

async function tagAllCommand(sock, chatId, senderId, message) {
    try {
        // Tunaita isAdmin lakini hatutaitumia kuzuia (Bypass)
        const { isBotAdmin } = await isAdmin(sock, chatId, senderId);

        // Bot lazima iwe admin ili kuweza kupata metadata ya group
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: '⚠️ Nifanye niwe *Admin* kwanza ili niweze kuona washiriki.' }, { quoted: message });
            return;
        }

        // Pata taarifa za group
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;

        if (!participants || participants.length === 0) {
            await sock.sendMessage(chatId, { text: 'Siwezi kupata washiriki wa kundi hili.' });
            return;
        }

        // --- MUONEKANO MPYA ---
        let messageText = `📢 *TAG ALL BY MICKEY GLITCH*\n\n`;
        messageText += `👥 *Jumla:* ${participants.length}\n`;
        messageText += `👤 *Aliyeita:* @${senderId.split('@')[0]}\n\n`;
        
        participants.forEach(participant => {
            messageText += `◦ @${participant.id.split('@')[0]}\n`;
        });

        // Safisha emoji kama ulivyotaka
        messageText = stripEmoji(messageText);

        // Tuma ujumbe wenye Mentions
        const sent = await sock.sendMessage(chatId, {
            text: messageText,
            mentions: participants.map(p => p.id)
        }, { quoted: message });

        // Kufuta ujumbe baada ya sekunde 30
        if (sent && sent.key) {
            setTimeout(async () => {
                try {
                    await sock.sendMessage(chatId, {
                        delete: sent.key
                    });
                } catch (err) {
                    console.error('Auto-delete failed:', err.message);
                }
            }, 30000);
        }

    } catch (error) {
        console.error('Error in tagall command:', error);
        await sock.sendMessage(chatId, { text: '❌ Imeshindwa kutag washiriki.' });
    }
}

module.exports = tagAllCommand;
