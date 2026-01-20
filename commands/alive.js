const moment = require('moment-timezone');

/**
 * Mickey Glitch Alive Command
 * Optimized to fix: 
 * 1. TypeError: conn.getName is not a function
 * 2. TypeError: Cannot read properties of undefined (reading 'fromMe')
 */
const aliveCommand = async (conn, m, text, usedPrefix, command) => {
  try {
    // FIX: Use m.pushName instead of conn.getName to avoid the function error
    const name = m.pushName || (conn.user && conn.user.name) || 'User';
    
    const uptime = clockString(process.uptime() * 1000);
    const date = moment.tz('Africa/Nairobi').format('DD/MM/YYYY');
    const time = moment.tz('Africa/Nairobi').format('HH:mm:ss');
    
    // Status Logic
    const statusText = `
╭─◇ *ᴍɪᴄᴋᴇʏ ɢʟɪᴛᴄʜ ᴀʟɪᴠᴇ* ◇─╮
│
│ 🙋 *Hello:* ${name}
│ 🤖 *Bot:* Online & Active
│ ⏳ *Uptime:* ${uptime}
│ 📅 *Date:* ${date}
│ ⏱ *Time:* ${time}
│ 📡 *Channel:* Mickey From Tanzania
│
╰──────────────╯

*System is currently running glitch-free.*
✨ _Type ${usedPrefix}menu to see all commands._`.trim();

    // FIX: Safe ContextInfo building
    const contextInfo = {
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363398106360290@newsletter',
            newsletterName: 'Mickey From Tanzania',
            serverMessageId: -1
        },
        externalAdReply: {
            title: `ᴍɪᴄᴋᴇʏ ɢʟɪᴛᴄʜ ᴠ2.0 ɪꜱ ᴀʟɪᴠᴇ`,
            body: `System Response: Success`,
            thumbnailUrl: 'https://water-billimg.onrender.com/1761205727440.png',
            sourceUrl: 'https://whatsapp.com/channel/0029VajVv9sEwEjw9T9S0C26',
            mediaType: 1,
            renderLargerThumbnail: true
        }
    };

    // FIX: Use a direct sendMessage and handle the 'quoted' object safely
    // By providing 'm' as quoted, we ensure Baileys doesn't look for 'fromMe' in an undefined object
    await conn.sendMessage(m.chat, {
      text: statusText,
      contextInfo: contextInfo
    }, { quoted: m });

  } catch (error) {
    // If an error occurs, log it and send a plain text message so the bot doesn't crash
    console.error('Alive Command Error:', error);
    await conn.sendMessage(m.chat, { text: '✨ *Mickey Glitch is Online*' }, { quoted: m });
  }
};

// Helper: Uptime Formatting
function clockString(ms) {
  let h = isNaN(ms) ? '00' : Math.floor(ms / 3600000);
  let m = isNaN(ms) ? '00' : Math.floor((ms % 3600000) / 60000);
  let s = isNaN(ms) ? '00' : Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

// Export formatted for your module system
module.exports = aliveCommand;
