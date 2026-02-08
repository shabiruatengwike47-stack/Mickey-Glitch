const moment = require('moment-timezone');
const owners = require('../data/owner.json');

const aliveCommand = async (conn, chatId, message) => {
  try {
    const name = message.pushName || (conn.user && conn.user.name) || 'User';
    const uptime = clockString(process.uptime() * 1000);
    const date = moment.tz('Africa/Nairobi').format('DD/MM/YYYY');
    const time = moment.tz('Africa/Nairobi').format('HH:mm:ss');

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

    const ownerNumber = (Array.isArray(owners) && owners[0]) ? owners[0] : '';

    // NEW INTERACTIVE MESSAGE STRUCTURE
    const interactiveMessage = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            header: {
              title: "⚡ MICKEY GLITCH v2.0.1",
              hasMediaAttachment: true,
              imageMessage: (await conn.prepareWAMessageMedia({ image: { url: 'https://water-billimg.onrender.com/1761205727440.png' } }, { upload: conn.waUploadToServer })).imageMessage
            },
            body: { text: statusText },
            footer: { text: "Choose an option below" },
            nativeFlowMessage: {
              buttons: [
                {
                  "name": "cta_url",
                  "buttonParamsJson": JSON.stringify({
                    "display_text": "Contact Owner",
                    "url": `https://wa.me/${ownerNumber}`,
                    "merchant_url": `https://wa.me/${ownerNumber}`
                  })
                },
                {
                  "name": "quick_reply",
                  "buttonParamsJson": JSON.stringify({
                    "display_text": "Menu",
                    "id": "menu"
                  })
                },
                {
                  "name": "cta_url",
                  "buttonParamsJson": JSON.stringify({
                    "display_text": "Join Channel",
                    "url": "https://whatsapp.com/channel/0029VajVv9sEwEjw9T9S0C26"
                  })
                }
              ]
            },
            contextInfo: {
              forwardingScore: 999,
              isForwarded: true,
              mentionedJid: [message.sender],
              forwardedNewsletterMessageInfo: {
                newsletterJid: '120363398106360290@newsletter',
                newsletterName: '🅼🅸🅲🅺🅴🆈 ɢʟɪᴛᴄʜ™',
                serverMessageId: -1
              }
            }
          }
        }
      }
    };

    await conn.relayMessage(chatId, interactiveMessage, { messageId: message.key.id });

  } catch (error) {
    console.error('Alive Command Failure:', error);
    await conn.sendMessage(chatId, { text: "⚠️ Error showing alive menu. Bot is online." }, { quoted: message });
  }
};

function clockString(ms) {
  let h = isNaN(ms) ? '00' : Math.floor(ms / 3600000);
  let m = isNaN(ms) ? '00' : Math.floor((ms % 3600000) / 60000);
  let s = isNaN(ms) ? '00' : Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

module.exports = aliveCommand;
