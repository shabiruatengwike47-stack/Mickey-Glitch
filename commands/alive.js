const moment = require('moment-timezone');

/**
 * Mickey Glitch Alive Command
 * FIX: Cannot read properties of undefined (reading 'fromMe')
 */
const aliveCommand = async (conn, chatId, message) => {
  try {
    // 1. Safe Name & Data Retrieval
    const name = message.pushName || (conn.user && conn.user.name) || 'User';
    const uptime = clockString(process.uptime() * 1000);
    const date = moment.tz('Africa/Nairobi').format('DD/MM/YYYY');
    const time = moment.tz('Africa/Nairobi').format('HH:mm:ss');

    // 2. Build Status Text - Premium Design
    const statusText = `╭━━━━━━━━━━━━━━━━━━━━━╮
┃  ✨ *MICKEY GLITCH* ✨
┃        v2.0.1
┣━━━━━━━━━━━━━━━━━━━━━┫
┃ 🟢 *Status:* Online
┃ 📊 *Health:* Excellent
┣━━━━━━━━━━━━━━━━━━━━━┫
┃ 👤 *User:* ${name}
┃ ⏱️ *Uptime:* ${uptime}
┃ 📅 *Date:* ${date}
┃ 🕐 *Time:* ${time}
┣━━━━━━━━━━━━━━━━━━━━━┫
┃ 🚀 All systems operational
┃ ✅ Ready to serve
┗━━━━━━━━━━━━━━━━━━━━━┛`.trim();

    // 3. Safe Message Sending with Premium Context
    await conn.sendMessage(chatId, {
      text: statusText,
      contextInfo: {
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363398106360290@newsletter',
          newsletterName: '🅼🅸🅲🅺🅴🆈 ɢʟɪᴛᴄʜ™',
          serverMessageId: -1
        },
        externalAdReply: {
          title: `⚡ MICKEY GLITCH v2.0.1`,
          body: `🟢 Bot Status: Perfect Health`,
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
    // If the error happens again, the bot won't crash
    console.error('Alive Command Failure:', error.message);
    
    // Fallback message with improved design
    await conn.sendMessage(chatId, { 
      text: `╭━━━━━━━━━━━━━━━━╮
┃ ✨ Bot Status
┣━━━━━━━━━━━━━━━━┫
┃ 🟢 Online
┃ ✅ Operational
┗━━━━━━━━━━━━━━━━┛` 
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
