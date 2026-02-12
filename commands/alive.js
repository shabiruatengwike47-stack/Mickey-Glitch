const moment = require('moment-timezone');
const owners = require('../data/owner.json');

/**
 * Mickey Glitch Alive Command - Ultra Stable Ad Edition
 */
const aliveCommand = async (conn, chatId, message) => {
  try {
    const name = message.pushName || 'User';
    const uptime = clockString(process.uptime() * 1000);
    const date = moment.tz('Africa/Nairobi').format('DD/MM/YYYY');
    const time = moment.tz('Africa/Nairobi').format('HH:mm:ss');
    const ownerNumber = (Array.isArray(owners) && owners[0]) ? owners[0] : '255615944741';

    // Minimalist English Layout
    const statusText = `*SYSTEM STATUS REPORT*

*CLIENT:* ${name}
*UPTIME:* ${uptime}
*STABILITY:* 100% Operational
*DATE:* ${date}
*TIME:* ${time}

*OWNER:* ${ownerNumber}
*VERSION:* Mickey Glitch v3.1.0`;

    const imageUrl = 'https://water-billimg.onrender.com/1761205727440.png';

    // Sending as a Single Media Ad Message
    await conn.sendMessage(chatId, {
      text: statusText,
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        showAdAttribution: true, // Forces the "Ad" label
        externalAdReply: {
          title: "MICKEY GLITCH AD: SYSTEM ACTIVE",
          body: "High-Speed Bot Connection",
          mediaType: 1,
          previewType: "PHOTO",
          thumbnailUrl: imageUrl,
          sourceUrl: "https://whatsapp.com/channel/0029VaN1N7m7z4kcO3z8m43V",
          renderLargerThumbnail: true // Makes the image appear large and clean
        }
      }
    }, { quoted: message });

  } catch (error) {
    console.error('[ALIVE ERROR]:', error.message);
    // Silent fail-safe to keep the bot running if a sync error occurs
  }
};

/**
 * Optimized time formatter
 */
function clockString(ms) {
  let h = Math.floor(ms / 3600000);
  let m = Math.floor((ms % 3600000) / 60000);
  let s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

module.exports = aliveCommand;
