const moment = require('moment-timezone');
const path = require('path');
const fs = require('fs');

// Enhanced tags mapping
const tagsMap = {
  main: '💗 Information',
  jadibot: '🌟 Sub Bot',
  downloader: '📥 Downloads',
  game: '🎮 Games',
  gacha: '🎲 Gacha RPG',
  rg: '🔰 Registration',
  group: '👥 Groups',
  nable: '🎛️ Features',
  nsfw: '🔞 NSFW +18',
  buscadores: '🔎 Search Tools',
  sticker: '🌈 Stickers',
  econ: '💰 Economy',
  convertidor: '🌀 Converters',
  logo: '🎀 Logo Generator',
  tools: '🧰 Tools',
  randow: '🎁 Random',
  efec: '🎶 Audio Effects',
  owner: '👑 Creator'
};

let handler = async (m, { conn, usedPrefix }) => {
  // Safety: Define a local reply function in case m.reply is missing
  const safeReply = async (text) => {
    return await conn.sendMessage(m.chat, { text }, { quoted: m });
  };

  try {
    const userId = (m.mentionedJid && m.mentionedJid[0]) || m.sender;
    
    // Safety check for global database
    const user = global.db?.data?.users?.[userId] || {};
    const name = await conn.getName(userId);
    const fecha = moment.tz('Africa/Nairobi').format('DD/MM/YYYY');
    const hora = moment.tz('Africa/Nairobi').format('HH:mm:ss');
    const uptime = clockString(process.uptime() * 1000);
    const totalreg = Object.keys(global.db?.data?.users || {}).length;
    const limit = user.limit || user.limite || 0;

    const botTag = conn.user?.jid?.split('@')[0] || 'bot';
    const isSubBot = conn.user?.jid !== global.conn?.user?.jid;
    
    const botOfc = isSubBot
      ? `🔗 *Sub Bot of:* wa.me/${global.conn?.user?.jid?.split('@')[0]}`
      : `🌐 *Official Bot:* wa.me/${botTag}`;

    // Group commands by tags
    const grouped = {};
    const plugins = Object.values(global.plugins || {}).filter(p => !p.disabled && p.command);

    for (const plugin of plugins) {
      const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
      const tagList = Array.isArray(plugin.tags) ? plugin.tags : (plugin.tags ? [plugin.tags] : ['main']);
      const tag = tagList[0];

      if (!grouped[tag]) grouped[tag] = [];
      for (const cmd of cmds) {
        if (typeof cmd === 'string') {
          // Clean regex characters from command names
          grouped[tag].push(cmd.replace(/^\^|\/|\.|\?|\[|\]|\$/g, ''));
        }
      }
    }

    // Build the menu text
    let menuBody = `╭─◇ *ᴍɪᴄᴋᴇʏ ɢʟɪᴛᴄʜ ʙᴏᴛ* ◇─╮\n`;
    menuBody += `│ 🙋 *User:* ${name}\n`;
    menuBody += `│ 🏷 *Limit:* ${limit}\n`;
    menuBody += `│ 📅 *Date:* ${fecha}\n`;
    menuBody += `│ ⏱ *Time:* ${hora}\n`;
    menuBody += `│ ⏳ *Uptime:* ${uptime}\n`;
    menuBody += `│ 👥 *Users:* ${totalreg}\n`;
    menuBody += `│ ${botOfc}\n`;
    menuBody += `╰──────────────╯\n`;

    const sortedTags = Object.keys(grouped).sort();
    for (const tag of sortedTags) {
      const sectionName = tagsMap[tag] || `📚 ${tag.toUpperCase()}`;
      menuBody += `\n╭─── *${sectionName}* ───╮\n`;
      
      const commands = [...new Set(grouped[tag])].sort();
      for (const cmd of commands) {
        menuBody += `│ • ${usedPrefix}${cmd}\n`;
      }
      menuBody += `╰─────────────────────╯\n`;
    }

    menuBody += `\n✨ *Type ${usedPrefix}menu to see command* ✨\n`;
    menuBody += `\n🌸 Hello ${name}, thank you for using my bot.`;

    // Send via conn.sendMessage instead of m.reply for safety
    await conn.sendMessage(m.chat, {
      text: menuBody.trim(),
      contextInfo: {
        mentionedJid: [m.sender],
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363398106360290@newsletter',
          newsletterName: 'Mickey From Tanzania',
          serverMessageId: -1,
        },
        externalAdReply: {
          title: `ᴍɪᴄᴋᴇʏ ɢʟɪᴛᴄʜ ʙᴏᴛ Menu`,
          body: `Bot active for ${name}`,
          thumbnailUrl: 'https://water-billimg.onrender.com/1761205727440.png',
          sourceUrl: 'https://whatsapp.com',
          mediaType: 1,
          renderLargerThumbnail: true,
        }
      }
    }, { quoted: m });

  } catch (error) {
    console.error('CRITICAL ERROR IN MENU:', error);
    await safeReply('❌ *Error loading commands.*\nStaff have been notified.');
  }
};

handler.help = ['menu', 'help'];
handler.tags = ['main'];
handler.command = /^(menu|help|commands|cmd)$/i;

module.exports = handler;

function clockString(ms) {
  let h = Math.floor(ms / 3600000);
  let m = Math.floor((ms % 3600000) / 60000);
  let s = Math.floor((ms % 60000) / 1000);
  return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':');
}
