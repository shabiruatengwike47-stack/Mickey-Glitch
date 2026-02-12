const moment = require('moment-timezone');
// Kwenye base uliyotoa, getBuffer ipo kwenye lib/myfunc au tumia axios
const axios = require('axios');
const owners = require('../data/owner.json');

const CONFIG = Object.freeze({
  BOT_NAME:    'Mickey Glitch',
  VERSION:     '3.2.6',
  DEFAULT_OWNER: '255615944741',
  TIMEZONE:    'Africa/Nairobi',
  THUMB_URL:   'https://water-billimg.onrender.com/1761205727440.png',
  CHANNEL_URL: 'https://whatsapp.com/channel/0029VaN1N7m7z4kcO3z8m43V',
  FOOTER:      '© Mickey Glitch Team • Stable & Fast'
});

function formatUptime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0 seconds';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  let res = [];
  if (d > 0) res.push(`${d}d`);
  if (h > 0) res.push(`${h}h`);
  if (m > 0) res.push(`${m}m`);
  res.push(`${s}s`);
  return res.join(' ');
}

const aliveCommand = async (conn, chatId, msg) => {
  try {
    const senderName = msg.pushName?.trim() || 'User';
    const ownerJid   = Array.isArray(owners) && owners[0] ? owners[0] : CONFIG.DEFAULT_OWNER;
    const now       = moment.tz(CONFIG.TIMEZONE);
    const uptime    = formatUptime(process.uptime());

    const statusText = `✦ *${CONFIG.BOT_NAME} STATUS* ✦

*Client* :  ${senderName}
*Status* :  *Online* ✅
*Uptime* :  ${uptime}
*Time* :  \`${now.format('DD MMM YYYY • HH:mm:ss')}\`
*Owner* :  wa.me/${ownerJid}

→ *${CONFIG.BOT_NAME} v${CONFIG.VERSION}*`;

    // Kutumia "Interactive Buttons" ambazo zinafanya kazi sasa
    const buttons = [
        {
            buttonId: '.menu',
            buttonText: { displayText: '📜 MENU LIST' },
            type: 1
        },
        {
            buttonId: '.owner',
            buttonText: { displayText: '👤 OWNER' },
            type: 1
        }
    ];

    const buttonMessage = {
        text: statusText,
        footer: CONFIG.FOOTER,
        buttons: buttons,
        headerType: 1,
        viewOnce: true, // Hii ni muhimu kwa buttons za sasa
        contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            externalAdReply: {
                showAdAttribution: true,
                title: `${CONFIG.BOT_NAME} ONLINE`,
                body: `Version: ${CONFIG.VERSION}`,
                mediaType: 1,
                previewType: 'PHOTO',
                thumbnailUrl: CONFIG.THUMB_URL,
                sourceUrl: CONFIG.CHANNEL_URL,
                renderLargerThumbnail: true
            }
        }
    };

    await conn.sendMessage(chatId, buttonMessage, { quoted: msg });

  } catch (err) {
    console.error('[ALIVE_ERROR]', err);
    conn.sendMessage(chatId, { text: `Bot is Online! 🚀\nUptime: ${formatUptime(process.uptime())}` }, { quoted: msg });
  }
};

module.exports = aliveCommand;
