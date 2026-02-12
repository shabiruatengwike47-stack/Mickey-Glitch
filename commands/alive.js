const moment = require('moment-timezone');
const owners = require('../data/owner.json');

// ────────────────────────────────────────────────
const CONFIG = {
  BOT_NAME: 'Mickey Glitch',
  VERSION: '3.2.0',
  DEFAULT_OWNER: '255615944741',
  TIMEZONE: 'Africa/Nairobi',
  IMAGE_URL: 'https://water-billimg.onrender.com/1761205727440.png',
  CHANNEL_LINK: 'https://whatsapp.com/channel/0029VaN1N7m7z4kcO3z8m43V',
  FOOTER_TEXT: '© Mickey Glitch Team'
};

// ────────────────────────────────────────────────
/**
 * Formats seconds into compact human-readable uptime string
 * @param {number} seconds - Process uptime in seconds
 * @returns {string} e.g. "2d 14h 33m 9s"
 */
function formatUptime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s';

  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return [
    d > 0 ? `${d}d` : '',
    h > 0 ? `${h}h` : '',
    m > 0 ? `${m}m` : '',
    `${s}s`
  ].filter(Boolean).join(' ') || '0s';
}

/**
 * @param {import('@whiskeysockets/baileys').BaileysInstance} conn
 * @param {string} chatId
 * @param {import('@whiskeysockets/baileys').proto.IWebMessageInfo} message
 */
async function aliveCommand(conn, chatId, message) {
  try {
    const pushName = message.pushName || 'User';
    const ownerJid = Array.isArray(owners) && owners.length > 0 ? owners[0] : CONFIG.DEFAULT_OWNER;

    const now = moment.tz(CONFIG.TIMEZONE);
    const uptimeStr = formatUptime(process.uptime());

    const lines = [
      '┌─── *SYSTEM STATUS* ───┐',
      '│',
      `│  • Client  :  ${pushName}`,
      `│  • Status  :  Operational`,
      `│  • Uptime  :  ${uptimeStr}`,
      `│  • Date    :  ${now.format('DD MMMM YYYY')}`,
      `│  • Time    :  ${now.format('HH:mm:ss')} EAT`,
      `│  • Owner   :  ${ownerJid}`,
      '│',
      `└──── ${CONFIG.BOT_NAME} ${CONFIG.VERSION} ────┘`
    ];

    const caption = lines.join('\n');

    const buttons = [
      {
        index: 1,
        urlButton: {
          displayText: '👤 Chat with Owner',
          url: `https://wa.me/${ownerJid}`
        }
      },
      {
        index: 2,
        callButton: {
          displayText: '📞 Call Owner',
          phoneNumber: `+${ownerJid}`
        }
      },
      {
        index: 3,
        quickReplyButton: {
          displayText: '📜 Menu',
          id: '.menu'
        }
      },
      {
        index: 4,
        quickReplyButton: {
          displayText: '✖ Close',
          id: '.cls'
        }
      }
    ];

    const externalAdReply = {
      title: `${CONFIG.BOT_NAME} ${CONFIG.VERSION}`,
      body: 'System Stability: 100%',
      mediaType: 1,
      previewType: 'PHOTO',
      thumbnailUrl: CONFIG.IMAGE_URL,
      sourceUrl: CONFIG.CHANNEL_LINK,
      renderLargerThumbnail: true,
      showAdAttribution: true
    };

    await conn.sendMessage(chatId, {
      image: { url: CONFIG.IMAGE_URL },
      caption,
      footer: CONFIG.FOOTER_TEXT,
      templateButtons: buttons,
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        externalAdReply
      }
    }, { quoted: message });

  } catch (err) {
    console.error('[ALIVE]', new Date().toISOString(), err?.message || err);
    // Optional: send error message to user or logs channel
    // await conn.sendMessage(chatId, { text: '⚠️ Failed to show status' }, { quoted: message });
  }
}

module.exports = aliveCommand;