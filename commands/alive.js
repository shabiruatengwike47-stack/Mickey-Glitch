const moment = require('moment-timezone');
const owners = require('../data/owner.json');

/**
 * Mickey Glitch Alive Command - English & Ad Media Version
 */
const aliveCommand = async (conn, chatId, message) => {
  try {
    const name = message.pushName || 'User';
    const uptime = clockString(process.uptime() * 1000);
    const date = moment.tz('Africa/Nairobi').format('DD/MM/YYYY');
    const time = moment.tz('Africa/Nairobi').format('HH:mm:ss');
    const ownerNumber = (Array.isArray(owners) && owners[0]) ? owners[0] : '255615944741';

    // Clean English Text (No decorative borders)
    const statusText = `*MICKEY GLITCH v3.1.0*

*USER:* ${name}
*STATUS:* Online & Stable
*UPTIME:* ${uptime}
*DATE:* ${date}
*TIME:* ${time} (EAT)
*OWNER:* ${ownerNumber}

*Powered by Mickey Glitch Team*`;

    const imageUrl = 'https://water-billimg.onrender.com/1761205727440.png';

    await conn.sendMessage(chatId, {
      image: { url: imageUrl },
      caption: statusText,
      contextInfo: {
        // This creates the "Message from Ad" look
        showAdAttribution: true, 
        forwardingScore: 999,
        isForwarded: true,
        externalAdReply: {
          title: "AD: SYSTEM ACTIVE",
          body: "Mickey Glitch Multidevice Bot",
          mediaType: 1,
          thumbnailUrl: imageUrl,
          sourceUrl: "https://github.com/MickeyGlitch", 
          renderLargerThumbnail: true
        }
      }
    }, { quoted: message });

  } catch (error) {
    console.error('[ALIVE] Error:', error.message);
    await conn.sendMessage(chatId, { 
      text: `❌ Error: ${error.message}` 
    }, { quoted: message });
  }
};

function clockString(ms) {
  let h = Math.floor(ms / 3600000);
  let m = Math.floor((ms % 3600000) / 60000);
  let s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

module.exports = aliveCommand;
