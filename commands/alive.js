const moment = require('moment-timezone');
const owners = require('../data/owner.json');

const aliveCommand = async (conn, chatId, msg) => {
  try {
    const senderName = msg.pushName || 'User';
    const ownerJid = owners[0] || '255615944741';
    const uptime = process.uptime(); 
    
    const statusText = `✦ *MICKEY GLITCH STATUS* ✦\n\n*Client* : ${senderName}\n*Status* : *Online* ✅\n*Uptime* : ${Math.floor(uptime / 60)} min\n*Owner* : wa.me/${ownerJid}`;

    // Hapa ndipo tunatengeneza Button za kweli
    let buttons = [
        {
            "name": "quick_reply",
            "buttonParamsJson": JSON.stringify({
                "display_text": "📜 MENU LIST",
                "id": ".menu"
            })
        },
        {
            "name": "cta_url",
            "buttonParamsJson": JSON.stringify({
                "display_text": "👤 CHAT OWNER",
                "url": `https://wa.me/${ownerJid}`,
                "merchant_url": `https://wa.me/${ownerJid}`
            })
        },
        {
            "name": "cta_call",
            "buttonParamsJson": JSON.stringify({
                "display_text": "📞 CALL OWNER",
                "phone_number": `+${ownerJid}`
            })
        }
    ];

    // Huu ndio muundo ambao WhatsApp haikatai
    let msgGenerated = await conn.relayMessage(chatId, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: { text: statusText },
                    footer: { text: "© Mickey Glitch Team" },
                    header: {
                        title: "Mickey Glitch v3.2.6",
                        hasMediaAttachment: true,
                        ...(await prepareWAMessageMedia({ image: { url: 'https://water-billimg.onrender.com/1761205727440.png' } }, { upload: conn.waUploadToServer }))
                    },
                    nativeFlowMessage: {
                        buttons: buttons
                    },
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 999,
                        externalAdReply: {
                            showAdAttribution: true,
                            title: 'Mickey Glitch Bot',
                            mediaType: 1,
                            previewType: 'PHOTO',
                            thumbnailUrl: 'https://water-billimg.onrender.com/1761205727440.png',
                            sourceUrl: 'https://whatsapp.com/channel/0029VaN1N7m7z4kcO3z8m43V'
                        }
                    }
                }
            }
        }
    }, {});

  } catch (err) {
    console.error('Button Error:', err);
    // Fallback kama relayMessage ikifeli
    conn.sendMessage(chatId, { text: "Bot is Online ✅ (Buttons failed to load)" });
  }
};

// Kumbuka ku-import prepareWAMessageMedia juu ya file lako kama haipo
const { prepareWAMessageMedia } = require("@whiskeysockets/baileys");
module.exports = aliveCommand;
