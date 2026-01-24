// ──────────────────────────────────────────────────────────────
//  🎯 ADVANCED HELP SYSTEM - Interactive Command Browser
//  Auto-synced from `commands/` folder with categorization
// ──────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const os = require('os');
const settings = require('../settings');

/**
 * COMMAND CATEGORIES - Organize commands by function
 */
const COMMAND_CATEGORIES = {
  admin:    ['ban', 'unban', 'kick', 'promote', 'demote', 'mute', 'unmute', 'warn', 'warnings', 'clear'],
  group:    ['groupmanage', 'tagall', 'tagnotadmin', 'tag', 'mention', 'hidetag'],
  fun:      ['compliment', 'character', 'wasted', 'emojimix', 'textmaker'],
  media:    ['sticker', 'sticker-alt', 'stickercrop', 'stickertelegram', 'img-blur', 'video', 'url', 'lyrics'],
  social:   ['instagram', 'facebook', 'tiktok', 'spotify', 'youtube'],
  download: ['play', 'igs', 'imagine'],
  utility:  ['ping', 'alive', 'update', 'checkupdates', 'settings', 'weather', 'translate', 'tts'],
  owner:    ['owner', 'pair', 'sudo', 'staff', 'resetlink', 'phone', 'halotel'],
  auto:     ['autostatus', 'autoread', 'autotyping', 'autobio', 'antitag', 'antidelete', 'antilink', 'antibadword'],
  ai:       ['ai', 'chatbot']
};

const EXCLUDE = ['help', 'index', 'main'];

function getUptime() {
  const uptime = process.uptime();
  const hours   = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  return `${hours}h ${minutes}m ${seconds}s`;
}

function readMessageText(message) {
  if (!message) return '';
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    ''
  ).trim();
}

function getCommandDescription(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).slice(0, 10); // look a bit deeper
    for (const ln of lines) {
      const t = ln.trim();
      if (!t) continue;
      if (t.startsWith('//'))  return t.replace(/^\/\/\s*/, '').trim();
      if (t.startsWith('/*'))  return t.replace(/^\/\*\s*/, '').replace(/\*\/$/, '').trim();
      if (t.startsWith('* '))  return t.replace(/^\*\s*/, '').trim();
    }
  } catch {
    // silent fail
  }
  return '';
}

function getCategoryEmoji(category) {
  const emojis = {
    admin:    '👮‍♂️',
    group:    '👥',
    fun:      '🎭',
    media:    '🖼️',
    social:   '🌐',
    download: '⬇️',
    utility:  '🛠️',
    owner:    '👑',
    auto:     '🤖',
    ai:       '🧠'
  };
  return emojis[category] || '📦';
}

function listCommandFiles() {
  const commandsDir = __dirname;
  let files = [];
  try {
    files = fs.readdirSync(commandsDir);
  } catch {
    return [];
  }

  return files
    .filter(f => f.endsWith('.js'))
    .map(f => path.basename(f, '.js'))
    .filter(name => !EXCLUDE.includes(name))
    .sort((a, b) => a.localeCompare(b))
    .map(name => {
      const fp = path.join(commandsDir, `${name}.js`);
      const desc = getCommandDescription(fp);
      let category = 'other';
      for (const [cat, list] of Object.entries(COMMAND_CATEGORIES)) {
        if (list.includes(name)) {
          category = cat;
          break;
        }
      }
      return { name, desc, category };
    });
}

function buildHelpMessage(cmdList, opts) {
  const { runtime, mode, prefix, ramUsed, ramTotal, time, name } = opts;

  const grouped = { other: [] };
  Object.keys(COMMAND_CATEGORIES).forEach(cat => grouped[cat] = []);

  cmdList.forEach(cmd => {
    grouped[cmd.category]?.push(cmd) || grouped.other.push(cmd);
  });

  let content = `🎯 *\( {settings.botName || 'Mickey Glitch'} COMMAND LIST* v \){settings.version || '?.?'}\n\n`;

  content += `▸ Uptime  : ${runtime}\n`;
  content += `▸ Mode    : ${mode || 'public'}\n`;
  content += `▸ Prefix  : ${prefix || '.'}\n`;
  content += `▸ RAM     : ${ramUsed} / ${ramTotal} GB\n`;
  content += `▸ Time    : ${time}\n`;
  content += `▸ User    : ${name || 'Unknown'}\n\n`;

  for (const [cat, cmds] of Object.entries(grouped)) {
    if (cmds.length === 0) continue;

    const emoji = getCategoryEmoji(cat);
    const title = cat.charAt(0).toUpperCase() + cat.slice(1);

    content += `\( {emoji} * \){title}* (${cmds.length})\n`;

    cmds.forEach(cmd => {
      const desc = cmd.desc ? ` — ${cmd.desc}` : '';
      content += `• \( {prefix} \){cmd.name}${desc}\n`;
    });

    content += '\n';
  }

  content += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  content += `✨ Total commands: ${cmdList.length}   |   Prefix: ${prefix || '.'}\n`;
  content += `━━━━━━━━━━━━━━━━━━━━━━━`;

  return content;
}

const FALLBACK_MSG = `*Help System*\n\nCould not generate command list at the moment.\nPlease try again or contact owner.`;

async function helpCommand(sock, chatId, message) {
  if (!sock || !chatId) {
    console.error('[help] Missing sock or chatId');
    return;
  }

  try {
    // ─── System & runtime info ────────────────────────────────
    const runtime   = getUptime();
    const mode      = settings.commandMode || 'public';
    const prefix    = settings.prefix || '.';
    const timeNow   = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const memUsed   = (process.memoryUsage().rss / 1024 ** 3).toFixed(2);
    const memTotal  = (os.totalmem() / 1024 ** 3).toFixed(2);

    // ─── Best effort username ─────────────────────────────────
    let displayName = 'Unknown';
    try {
      const senderJid = message?.key?.participant || message?.key?.remoteJid || message?.key?.fromMe ? message.key.fromMe ? 'self' : null : null;
      if (senderJid && senderJid.includes('@s.whatsapp.net')) {
        displayName = (await sock.getName?.(senderJid)) || senderJid.split('@')[0];
      }
    } catch {}

    const cmdList = listCommandFiles();

    if (!cmdList.length) {
      await sock.sendMessage(chatId, { text: FALLBACK_MSG }, { quoted: message });
      return;
    }

    const helpText = buildHelpMessage(cmdList, {
      runtime,
      mode,
      prefix,
      ramUsed: memUsed,
      ramTotal: memTotal,
      time: timeNow,
      name: displayName
    });

    // ─── Send with safe splitting (WhatsApp ~4096 char limit) ───
    const MAX_SAFE = 3800;

    if (helpText.length <= MAX_SAFE) {
      await sock.sendMessage(chatId, { text: helpText }, { quoted: message });
      return;
    }

    // Split into parts
    const parts = [];
    let chunk = '';
    const lines = helpText.split('\n');

    for (const line of lines) {
      if (chunk.length + line.length + 2 > MAX_SAFE) {
        parts.push(chunk.trimEnd());
        chunk = line + '\n';
      } else {
        chunk += line + '\n';
      }
    }
    if (chunk.trim()) parts.push(chunk.trimEnd());

    // Send parts sequentially
    for (let i = 0; i < parts.length; i++) {
      const text = parts[i];
      const footer = parts.length > 1 ? `📚 Page \( {i + 1}/ \){parts.length}` : '';
      await sock.sendMessage(chatId, { text }, { quoted: message });
      if (i < parts.length - 1) await new Promise(r => setTimeout(r, 700)); // avoid flood
    }

  } catch (err) {
    console.error('[help] Error:', err);
    await sock.sendMessage(chatId, {
      text: `*Error in help command*\n\( {err.message || 'Unknown error'}\n\n \){FALLBACK_MSG}`
    }, { quoted: message });
  }
}

module.exports = helpCommand;