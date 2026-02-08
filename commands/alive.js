const moment = require('moment-timezone');
const owners = require('../data/owner.json');
// Tunatumia library ya reysbott uliyoweka kwenye package.json kama alias
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('baileys-buttons');

/**
 * Mickey Glitch Alive Command - Interactive Button Version
 * Inatumia muundo wa 'baileys-buttons' kuonyesha vitufe.
 */
const aliveCommand = async (conn, chatId, message) => {
  try {
    // 1. Data Setup
    const name = message.pushName || 'User';
    const uptime = clockString(process.uptime() * 1000);
    const date = moment.tz('Africa/Nairobi').format('DD/MM/YYYY');
    const time = moment.tz('Africa/Nairobi').format('HH:mm:ss');
    const ownerNumber = (Array.isArray(owners) && owners[0]) ? owners[0] : '255615944741';

    // 2. Maandishi ya Alive
    const statusText = `*───〔 ⚡ MICKEY GLITCH v3.1.0 〕───*

👤 *USER:* ${name}
🚀 *STATUS:* All Systems Operational
📟 *UPTIME:* ${uptime}
📅 *DATE:* ${date}
🕒 *TIME:* ${time} (EAT)

*───〔 INFO 〕───*
Bonyeza vitufe hapa chini kupata huduma.`;

    // 3. Kutengeneza Button kwa kutumia muundo wa Interactive Message
    const buttons = [
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📜 MENU LIST",
          id: ".menu"
        })
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "👤 OWNER INFO",
          id: ".owner"
        })
      }
    ];

    // 4. Kutengeneza Ujumbe wa Interactive
    let msg = generateWAMessageFromContent(chatId, {
      viewOnceMessage: {
        message: {
          interactiveMessage: proto.Message.InteractiveMessage.fromObject({
            body: proto.Message.InteractiveMessage.Body.fromObject({
              text: statusText
            }),
            footer: proto.Message.InteractiveMessage.Footer.fromObject({
              text: "© Powered by Mickey Glitch Team"
            }),
            header: proto.Message.InteractiveMessage.Header.fromObject({
              title: "MICKEY GLITCH IS ACTIVE 🟢",
              hasMediaAttachment: true,
              ...(await prepareWAMessageMedia({ image: { url: 'https://water-billimg.onrender.com/1761205727440.png' } }, { upload: conn.waUploadToServer }))
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
              buttons: buttons
            }),
            contextInfo: {
              mentionedJid: [message.sender],
              forwardingScore: 999,
              isForwarded: true,
              externalAdReply: {
                title: "🅼🅸🅲🅺🅴🆈 ɢʟɪᴛᴄʜ™",
                body: "Direct System Control",
                thumbnailUrl: 'https://water-billimg.onrender.com/1761205727440.png',
                sourceUrl: 'https://whatsapp.com/channel/0029VajVv9sEwEjw9T9S0C26',
                mediaType: 1,
                renderLargerThumbnail: false
              }
            }
          })
        }
      }
    }, { quoted: message });

    // Tuma ujumbe
    await conn.relayMessage(chatId, msg.message, { messageId: msg.key.id });

  } catch (error) {
    console.error('Alive Command Failure:', error.message);
    // Fallback kama buttons zikifeli
    await conn.sendMessage(chatId, { 
      text: `*Mickey Glitch is Online* 🟢\nUptime: ${clockString(process.uptime() * 1000)}\n\n_System failed to render buttons._` 
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
