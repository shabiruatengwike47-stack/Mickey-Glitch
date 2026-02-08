const moment = require('moment-timezone');
const owners = require('../data/owner.json');

/**
 * Mickey Glitch Alive Command - Premium Minimalist Version
 * Removed buttons to ensure 100% display compatibility
 */
const aliveCommand = async (conn, chatId, message) => {
  try {
    // 1. Data Setup
    const name = message.pushName || (conn.user && conn.user.name) || 'User';
    const uptime = clockString(process.uptime() * 1000);
    const date = moment.tz('Africa/Nairobi').format('DD/MM/YYYY');
    const time = moment.tz('Africa/Nairobi').format('HH:mm:ss');
    const ownerNumber = (Array.isArray(owners) && owners[0]) ? owners[0] : 'N/A';

    // 2. Premium Status UI (Text-Based Design)
    const statusText = `
*───〔 ⚡ MICKEY GLITCH v2.0.1 〕───*

👤 *USER:* ${name}
🚀 *STATUS:* All Systems Operational
📟 *UPTIME:* ${uptime}
📅 *DATE:* ${date}
🕒 *TIME:* ${time} (EAT)

*───〔 SYSTEM METRICS 〕───*

📡 *Latency:* Stable
🟢 *Connection:* Strong
🛠️ *Owner:* ${ownerNumber}

*───〔 INFO 〕───*
_Type .menu to see all available commands._
_Type .ping to check response speed._

> *Powered by Mickey Glitch Team*`.trim();

    // 3. Send Message with Large Thumbnail Context
    await conn.sendMessage(chatId, {
      text: statusText,
      contextInfo: {
        isForwarded: true,
        forwardingScore: 999,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363398106360290@newsletter',
          newsletterName: '🅼🅸🅲🅺🅴🆈 ɢʟɪᴛᴄʜ™',
          serverMessageId: -1
        },
        externalAdReply: {
          title: `MICKEY GLITCH IS ACTIVE 🟢`,
          body: `System Uptime: ${uptime}`,
          thumbnailUrl: 'https://water-billimg.onrender.com/1761205727440.png',
          sourceUrl: 'https://whatsapp.com/channel/0029VajVv9sEwEjw9T9S0C26',
          mediaType: 1,
          renderLargerThumbnail: true
        }
      }
    }, { 
      quoted: message 
    });

  } catch (error) {
    console.error('Alive Command Failure:', error.message);
    
    // Simple fallback
    await conn.sendMessage(chatId, { 
      text: `*Mickey Glitch is Online* 🟢\nUptime: ${clockString(process.uptime() * 1000)}` 
    }, { quoted: message });
  }
};

// Standard Uptime Helper
function clockString(ms) {
  let h = isNaN(ms) ? '00' : Math.floor(ms / 3600000);
  let m = isNaN(ms) ? '00' : Math.floor((ms % 3600000) / 60000);
  let s = isNaN(ms) ? '00' : Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

module.exports = aliveCommand;
