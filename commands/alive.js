const { 
    generateWAMessageFromContent, 
    proto 
} = require("@whiskeysockets/baileys");
const moment = require('moment-timezone');

const aliveCommand = async (conn, chatId, msg) => {
  try {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    const statusText = `✦ *MICKEY GLITCH BOT* ✦
    
*Status* : Online ✅
*Uptime* : ${hours}h ${minutes}m
*Version*: 3.2.6`;

    // Tunatumia "Sections" badala ya buttons za kawaida
    const sections = [
        {
            title: "Mickey Glitch Menu",
            rows: [
                { title: "📜 Main Menu", rowId: ".menu", description: "Onyesha amri zote za bot" },
                { title: "👤 Owner", rowId: ".owner", description: "Wasiliana na muundaji" },
                { title: "📡 Channel", rowId: ".channel", description: "Jiunge na updates" }
            ]
        }
    ];

    const listMessage = {
        title: "BONYEZA HAPA",
        sections
    };

    // MUHIMU: Tunatumia relayMessage bila kuweka forwarding contextInfo
    const msgGenerated = generateWAMessageFromContent(chatId, {
        listMessage: listMessage,
        body: { text: statusText },
        footer: { text: "© Mickey Glitch Team" },
        contextInfo: {
            externalAdReply: {
                title: 'MICKDADY - ONLINE',
                mediaType: 1,
                thumbnailUrl: 'https://water-billimg.onrender.com/1761205727440.png',
                sourceUrl: 'https://whatsapp.com/channel/0029VajVv9sEwEjw9T9S0C26',
                renderLargerThumbnail: true
            }
        }
    }, { quoted: msg });

    await conn.relayMessage(chatId, msgGenerated.message, {});

  } catch (err) {
    console.error('List Message Error:', err);
    await conn.sendMessage(chatId, { text: "Bot Online ✅" });
  }
};

module.exports = aliveCommand;
