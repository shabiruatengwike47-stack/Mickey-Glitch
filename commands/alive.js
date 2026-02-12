const moment = require('moment-timezone');
const owners = require('../data/owner.json');

const CONFIG = Object.freeze({
  BOT_NAME:    'Mickey Glitch',
  VERSION:     '3.2.6',
  DEFAULT_OWNER: '255615944741',
  TIMEZONE:    'Africa/Nairobi',
  THUMB_URL:   'https://water-billimg.onrender.com/1761205727440.png',
  CHANNEL_URL: 'https://whatsapp.com/channel/0029VaN1N7m7z4kcO3z8m43V',
  FOOTER:      '© Mickey Glitch Team'
});

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

const aliveCommand = async (conn, chatId, msg) => {
  try {
    const senderName = msg.pushName?.trim() || 'User';
    const ownerJid   = Array.isArray(owners) && owners[0] ? owners[0] : CONFIG.DEFAULT_OWNER;
    const uptime    = formatUptime(process.uptime());
    const now       = moment.tz(CONFIG.TIMEZONE);

    const statusText = `✦ *${CONFIG.BOT_NAME} STATUS* ✦

*Client* : ${senderName}
*Status* : *Online* ✅
*Uptime* : ${uptime}
*Time* : \`${now.format('HH:mm:ss')}\`
*Owner* : wa.me/${ownerJid}

*Piga kura chini kuchagua:*`;

    // Tunatuma Poll badala ya Buttons
    await conn.sendMessage(chatId, {
        poll: {
            name: statusText,
            values: [
                '📜 MENU LIST',
                '👤 OWNER',
                '✖ CLOSE'
            ],
            selectableCount: 1 // Mtumiaji achague moja tu
        },
        contextInfo: {
            externalAdReply: {
                title: `${CONFIG.BOT_NAME} V${CONFIG.VERSION}`,
                body: `Runtime: ${uptime}`,
                mediaType: 1,
                thumbnailUrl: CONFIG.THUMB_URL,
                sourceUrl: CONFIG.CHANNEL_URL,
                renderLargerThumbnail: true
            }
        }
    }, { quoted: msg });

  } catch (err) {
    console.error(err);
  }
};

module.exports = aliveCommand;
