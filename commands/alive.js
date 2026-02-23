const moment = require('moment-timezone');
const os = require('os');

const formatUptime = (secs) => {
    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

const aliveCommand = async (conn, chatId, msg) => {
    try {
        await conn.sendPresenceUpdate('composing', chatId);

        // Uptime & system stats
        const uptime = process.uptime();
        const uptimeText = formatUptime(uptime);
        const memUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        const memTotal = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);
        const cpuModel = (os.cpus() && os.cpus()[0] && os.cpus()[0].model) || 'Unknown CPU';
        const platform = `${os.type()} ${os.arch()}`;

        // Ping estimation (message timestamp -> ms)
        let ping = 'N/A';
        if (msg && msg.messageTimestamp) {
            ping = `${Date.now() - (msg.messageTimestamp * 1000)} ms`;
        }

        // Time & date (local or Tanzania fallback)
        const tz = process.env.TIMEZONE || 'Africa/Dar_es_Salaam';
        const time = moment().tz(tz).format('hh:mm:ss A');
        const date = moment().tz(tz).format('DD/MM/YYYY');

        // Image and caption
        const imageUrl = process.env.AD_IMAGE_URL || 'https://files.catbox.moe/llc9v7.png';
        const title = '✨ MICKEY GLITCH BOT ✨';
        const caption = `*${title}*\n\n` +
            `👤 *User:* ${msg.pushName || 'Guest'}\n` +
            `🟢 *Status:* Online\n` +
            `🕐 *Time:* ${time}  •  *Date:* ${date}\n` +
            `⚡ *Ping:* ${ping}\n` +
            `⏳ *Uptime:* ${uptimeText}\n` +
            `🧠 *Memory:* ${memUsed}MB / ${memTotal}MB\n` +
            `💻 *Platform:* ${platform}\n` +
            `🔧 *CPU:* ${cpuModel}\n\n` +
            `_Fast • Reliable • Powerful_`;

        // Buttons (trigger common commands)
        const buttons = [
            { buttonId: '.owner', buttonText: { displayText: 'Owner' }, type: 1 },
            { buttonId: '.help', buttonText: { displayText: 'Help' }, type: 1 },
            { buttonId: '.ping', buttonText: { displayText: 'Ping' }, type: 1 }
        ];

        const messagePayload = {
            image: { url: imageUrl },
            caption: caption,
            footer: 'MICKEY GLITCH • v3',
            buttons: buttons,
            headerType: 4,
            contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: process.env.NEWSLETTER_JID || '120363398106360290@newsletter',
                    newsletterName: 'MICKEY NEWS',
                    serverMessageId: Date.now() % 100000
                },
                externalAdReply: {
                    title: 'MICKEY GLITCH - ONLINE',
                    body: 'Fast • Reliable • Powerful',
                    thumbnailUrl: imageUrl,
                    sourceUrl: process.env.AD_SOURCE_URL || '',
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        };

        await conn.sendMessage(chatId, messagePayload, { quoted: msg });

    } catch (error) {
        console.error('❌ Alive Command Error:', error);
        try { await conn.sendMessage(chatId, { text: '⚠️ Error while preparing status.' }, { quoted: msg }); } catch (e) { }
    }
};

module.exports = aliveCommand;
