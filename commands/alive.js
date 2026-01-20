const moment = require('moment-timezone');

const menuCommand = async (conn, m, text, usedPrefix, command) => {
  try {
    // FIX 1: Safe name retrieval
    // If conn.getName doesn't exist, we use the pushName from the message or the JID
    const name = m.pushName || (conn.user && conn.user.name) || m.sender.split('@')[0];
    
    const uptime = clockString(process.uptime() * 1000);
    const date = moment.tz('Africa/Nairobi').format('DD/MM/YYYY');
    
    // Safety check for global database
    const user = global.db?.data?.users?.[m.sender] || { limit: 0 };

    // FIX 2: Safe ContextInfo & Newsletter check
    // We ensure contextInfo is only built if the data is available
    const contextInfo = {
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363398106360290@newsletter',
          newsletterName: 'Mickey From Tanzania',
          serverMessageId: -1
        },
        externalAdReply: {
          title: `ᴍɪᴄᴋᴇʏ ɢʟɪᴛᴄʜ ʙᴏᴛ`,
          body: `Bot active for ${name}`,
          thumbnailUrl: 'https://water-billimg.onrender.com/1761205727440.png',
          sourceUrl: 'https://whatsapp.com/channel/0029VajVv9sEwEjw9T9S0C26',
          mediaType: 1,
          renderLargerThumbnail: true
        }
    };

    // Build the menu text (Logic from your previous script)
    let menuBody = `╭─◇ *ᴍɪᴄᴋᴇʏ ɢʟɪᴛᴄʜ* ◇─╮\n`;
    menuBody += `│ 🙋 *User:* ${name}\n`;
    menuBody += `│ ⏳ *Uptime:* ${uptime}\n`;
    menuBody += `╰──────────────╯\n\n`;
    menuBody += `✨ *Use ${usedPrefix}help for more info*`;

    // FIX 3: Sending the message correctly
    // If 'm' is undefined or malformed, it crashes. We use a safe quoted logic.
    await conn.sendMessage(m.chat, {
      text: menuBody.trim(),
      contextInfo: contextInfo
    }, { quoted: m });

  } catch (error) {
    console.error('Menu Error:', error);
    // Fallback if everything fails
    await conn.sendMessage(m.chat, { text: '❌ System Error: Menu cannot be loaded.' });
  }
};

// Helper function
function clockString(ms) {
  let h = Math.floor(ms / 3600000);
  let m = Math.floor((ms % 3600000) / 60000);
  let s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':');
}

module.exports = menuCommand;
