const moment = require('moment-timezone');
const owners = require('../data/owner.json');

/** * Mickey Glitch Alive Command - Link Preview Version (No Buttons)
 */
const aliveCommand = async (conn, chatId, message) => {
    try {
        // 1. Data Preparation
        const name = message.pushName || 'User';
        const uptime = clockString(process.uptime() * 1000);
        const date = moment.tz('Africa/Nairobi').format('DD/MM/YYYY');
        const time = moment.tz('Africa/Nairobi').format('HH:mm:ss');
        const ownerNumber = (Array.isArray(owners) && owners[0]) ? owners[0] : '255615944741';
        const imageUrl = 'https://water-billimg.onrender.com/1761205727440.png';

        const statusText = `*───〔 ⚡ MICKEY GLITCH v3.1.0 〕───* 👤 *USER:* ${name}
🚀 *STATUS:* All Systems Operational
📟 *UPTIME:* ${uptime}
📅 *DATE:* ${date}
🕒 *TIME:* ${time} (EAT)

*───〔 SYSTEM METRICS 〕───*
📡 *Latency:* Stable 🟢
🛠️ *Connection:* Strong
👤 *Owner:* ${ownerNumber}

> *Powered by Mickey Glitch Team*`;

        // 2. Send Message with ExternalAdReply (The "Feature" replacement for buttons)
        await conn.sendMessage(chatId, {
            text: statusText,
            contextInfo: {
                mentionedJid: [message.sender],
                forwardingScore: 999,
                isForwarded: true, // Adds the "Forwarded" tag for a formal look
                externalAdReply: {
                    title: "🅼🅸🅺🅴🆈 ɢʟɪᴛᴄʜ™ IS ONLINE",
                    body: "System Status: Active",
                    thumbnailUrl: imageUrl,
                    sourceUrl: 'https://whatsapp.com/channel/0029VajVv9sEwEjw9T9S0C26',
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: message });

    } catch (error) {
        console.error('Alive Command Failure:', error.message);
        await conn.sendMessage(chatId, { text: `*Mickey Glitch is Online* 🟢\nUptime: ${clockString(process.uptime() * 1000)}` }, { quoted: message });
    }
};

function clockString(ms) {
    let h = Math.floor(ms / 3600000);
    let m = Math.floor((ms % 3600000) / 60000);
    let s = Math.floor((ms % 60000) / 1000);
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':'); 
}

module.exports = aliveCommand;
