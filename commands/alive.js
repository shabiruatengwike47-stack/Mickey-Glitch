const moment = require('moment-timezone');

const aliveCommand = async (conn, chatId, msg) => {
  try {
    const uptime = Math.floor(process.uptime());
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);

    const statusText = `✦ *MICKEY GLITCH BOT* ✦
    
*Status* : Online ✅
*Uptime* : ${h}h ${m}m
*Version*: 3.2.6

*BONYEZA PICHA HAPA CHINI:*`;

    await conn.sendMessage(chatId, {
        text: statusText,
        contextInfo: {
            externalAdReply: {
                title: "📜 BONYEZA HAPA KUPATA MENU",
                body: "Mickey Glitch Bot - Stable & Fast",
                mediaType: 1,
                previewType: 0,
                renderLargerThumbnail: true,
                thumbnailUrl: 'https://water-billimg.onrender.com/1761205727440.png',
                // Hapa unaweka command yako kama link (inafanya kazi baadhi ya simu)
                sourceUrl: `https://wa.me/255615944741?text=.menu`
            }
        }
    }, { quoted: msg });

  } catch (err) {
    console.error(err);
    await conn.sendMessage(chatId, { text: "Online ✅" });
  }
};

module.exports = aliveCommand;
