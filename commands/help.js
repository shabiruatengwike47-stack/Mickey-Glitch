const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');
const owners = require('../data/owner.json');

// ────────────────────────────────────────────────
const CONFIG = Object.freeze({
  BOT_NAME:    'Mickey Glitch',
  VERSION:     '3.2.6',
  DEFAULT_OWNER: '255615944741',
  TIMEZONE:    'Africa/Nairobi',
  THUMB_URL:   'https://water-billimg.onrender.com/1761205727440.png',
  CHANNEL_URL: 'https://whatsapp.com/channel/0029VaN1N7m7z4kcO3z8m43V',
  FOOTER:      '© Mickey Glitch Team • Stable & Fast'
});

/**
 * Format uptime
 */
function formatUptime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0 seconds';
  const units = [
    { value: Math.floor(seconds / 86400), unit: 'd' },
    { value: Math.floor((seconds % 86400) / 3600), unit: 'h' },
    { value: Math.floor((seconds % 3600) / 60), unit: 'm' },
    { value: Math.floor(seconds % 60), unit: 's' }
  ];
  return units.filter(u => u.value > 0).map(u => `${u.value}${u.unit}`).join(' ') || '0s';
}

/**
 * Alive / Status Command
 */
const aliveCommand = async (conn, chatId, msg) => {
  try {
    const senderName = msg.pushName?.trim() || 'User';
    const ownerJid   = Array.isArray(owners) && owners[0] ? owners[0] : CONFIG.DEFAULT_OWNER;
    const now       = moment.tz(CONFIG.TIMEZONE);
    const uptime    = formatUptime(process.uptime());

    // ─── [ SEHEMU YA KUTAFUTA COMMANDS ] ───
    let totalCommands = 0;
    try {
        // 1. Inasoma folder la commands
        const cmdPath = path.join(__dirname, '../commands');
        if (fs.existsSync(cmdPath)) {
            const files = fs.readdirSync(cmdPath).filter(file => file.endsWith('.js'));
            totalCommands += files.length;
        }
        
        // 2. Inakagua commands zilizoko kwenye main memory (global)
        // Inatafuta majina ya kawaida yanayotumiwa kwenye base hii:
        const globalCmds = global.commands || global.events || global.plugins || {};
        const extraCount = Object.keys(globalCmds).length;
        
        // Kama amri kwenye folder tayari zipo kwenye global, tusizirudie
        if (extraCount > totalCommands) {
            totalCommands = extraCount;
        }
    } catch (e) {
        console.warn('Command fetch error:', e.message);
    }
    // ───────────────────────────────────────

    const statusText = `✦ *${CONFIG.BOT_NAME} STATUS* ✦

*Client* :  ${senderName}
*Status* :  *Online* ✅
*Uptime* :  ${uptime}
*Commands*:  ${totalCommands} Active
*Time* :  \`${now.format('DD MMM YYYY • HH:mm:ss')}\` EAT
*Owner* :  wa.me/${ownerJid}

→ *${CONFIG.BOT_NAME} v${CONFIG.VERSION}* – Running since last restart`;

    await conn.sendMessage(chatId, {
      text: statusText,
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363398106360290@newsletter',
            newsletterName: '🅼🅸🅲🅺🅴𝚈'
        },
        externalAdReply: {
          showAdAttribution: true,
          title: `${CONFIG.BOT_NAME} ${CONFIG.VERSION}`,
          body: `System Online | ${totalCommands} Commands`,
          mediaType: 1,
          previewType: 'PHOTO',
          thumbnailUrl: CONFIG.THUMB_URL,
          sourceUrl: CONFIG.CHANNEL_URL,
          renderLargerThumbnail: true
        }
      }
    }, { quoted: msg });

  } catch (err) {
    console.error('[ALIVE_ERROR]', err);
    conn.sendMessage(chatId, {
      text: `⚠️ *${CONFIG.BOT_NAME}* is alive!\nUptime: ${formatUptime(process.uptime())}`
    }, { quoted: msg }).catch(console.warn);
  }
};

module.exports = aliveCommand;
