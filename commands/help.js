// help.js
// ──────────────────────────────────────────────────────────────
//  Help – Auto-generated command list + TTS greeting
// ──────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const os = require('os');
const settings = require('../settings');
const gTTS = require('gtts');

const EXCLUDE = ['help']; // ← add more command names here to hide them
const BANNER = 'https://water-billimg.onrender.com/1761205727440.png';

const FALLBACK_MSG = `*Help*\nUnable to generate dynamic command list at the moment.`;

/**
 * Best-effort friendly name for greeting & header
 * Priority: contact name → pushName → phone number
 */
async function getBestDisplayName(sock, message) {
  try {
    const jid =
      message?.key?.participant ||
      message?.key?.from ||
      message?.key?.remoteJid ||
      '';

    if (!jid) return 'friend';

    // Try real contact name if store / getContact is available
    if (typeof sock?.getContact === 'function') {
      try {
        const contact = await sock.getContact(jid);
        if (contact?.name || contact?.verifiedName || contact?.notify) {
          return (contact.name || contact.verifiedName || contact.notify).trim();
        }
      } catch {
        // silent
      }
    }

    // WhatsApp display name
    if (message?.pushName?.trim()) {
      return message.pushName.trim();
    }

    // Phone number fallback
    return jid.split('@')[0] || 'someone';
  } catch {
    return 'friend';
  }
}

function getUptime() {
  const sec = process.uptime();
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

function readMessageText(msg) {
  if (!msg?.message) return '';
  const m = msg.message;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  ).trim();
}

function getCommandDescription(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split(/\r?\n/).slice(0, 12);
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith('//')) return t.replace(/^\/\/\s*/, '').trim();
      if (t.startsWith('/*')) return t.replace(/^\/\*\s*/, '').replace(/\*\/$/, '').trim();
      if (t.startsWith('*')) return t.replace(/^\*\s*/, '').trim();
    }
  } catch {}
  return '';
}

function listCommandFiles() {
  try {
    const dir = __dirname;
    return fs
      .readdirSync(dir)
      .filter(file => file.endsWith('.js'))
      .map(file => path.basename(file, '.js'))
      .filter(name => !EXCLUDE.includes(name))
      .sort()
      .map(name => {
        const fp = path.join(dir, `${name}.js`);
        return {
          name,
          desc: getCommandDescription(fp),
        };
      });
  } catch {
    return [];
  }
}

function buildHelpMessage(commands, opts = {}) {
  const {
    runtime = getUptime(),
    mode = settings.commandMode || 'public',
    prefix = settings.prefix || '.',
    ramUsed = '?',
    ramTotal = '?',
    time = new Date().toLocaleTimeString('en-GB', { hour12: false }),
    name = 'User',
  } = opts;

  const header = `*🤖 ${settings.botName || '𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑'}*\n\n` +
    `👑 Owner: ${settings.botOwner || 'Mickey'}\n` +
    `✨ User: \( {name} | v \){settings.version || '?.?'}\n` +
    `⏱ Uptime: ${runtime} | ⌚ ${time}\n` +
    `🛡 Mode: ${mode} | Prefix: ${prefix}\n` +
    `🧠 RAM: ${ramUsed} / ${ramTotal} GB\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const title = `*📋 Commands (${commands.length})*\n\n`;

  // ─── FIXED: correct prefix rendering ───
  const commandList = commands
    .map(cmd => {
      const fullCmd = `\( {prefix} \){cmd.name}`;
      const desc = cmd.desc ? ` - ${cmd.desc}` : '';
      return `▸ *\( {fullCmd}* \){desc}`;
    })
    .join('\n');

  const footer = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📊 Total: ${commands.length} | Hidden: ${EXCLUDE.length}`;

  return header + title + commandList + footer;
}

async function sendTTSGreeting(sock, chatId, message) {
  try {
    const displayName = await getBestDisplayName(sock, message);
    const greeting = `Hello ${displayName}, thanks for using the bot. Enjoy Mickey Glitch!`;

    const filename = `greet-${Date.now()}.mp3`;
    const assetsDir = path.join(__dirname, '..', 'assets');
    const filepath = path.join(assetsDir, filename);

    await fs.promises.mkdir(assetsDir, { recursive: true });

    const gtts = new gTTS(greeting, 'en');

    await new Promise((resolve, reject) => {
      gtts.save(filepath, err => (err ? reject(err) : resolve()));
    });

    const buffer = await fs.promises.readFile(filepath);

    await sock.sendMessage(chatId, {
      audio: buffer,
      mimetype: 'audio/mpeg',
      ptt: true,
    }, { quoted: message });

    fs.unlink(filepath, () => {}); // cleanup
  } catch (err) {
    console.error('[TTS Greeting] Failed:', err);
    // silent fail
  }
}

async function helpCommand(sock, chatId, message) {
  if (!sock || !chatId) return;

  try {
    // System info
    const memUsed = (process.memoryUsage().rss / 1024 ** 3).toFixed(2);
    const memTotal = (os.totalmem() / 1024 ** 3).toFixed(2);

    const displayName = await getBestDisplayName(sock, message);
    const senderNumber = (message?.key?.participant || message?.key?.from || '')
      .split('@')[0] || 'Unknown';

    const commands = listCommandFiles();

    if (commands.length === 0) {
      return sock.sendMessage(chatId, { text: FALLBACK_MSG }, { quoted: message });
    }

    const helpText = buildHelpMessage(commands, {
      ramUsed: memUsed,
      ramTotal: memTotal,
      name: displayName,
    });

    // ─── Send help ───────────────────────────────────────
    if (helpText.length > 4000) {
      const tmpFile = path.join(os.tmpdir(), `help-${Date.now()}.txt`);
      fs.writeFileSync(tmpFile, helpText, 'utf8');

      await sock.sendMessage(chatId, {
        document: { url: tmpFile },
        fileName: `commands-${new Date().toISOString().slice(0,10)}.txt`,
        mimetype: 'text/plain',
        caption: `📚 Full command list (v${settings.version || '?.?'})`,
      }, { quoted: message });

      fs.unlink(tmpFile, () => {});
    } else {
      await sock.sendMessage(chatId, {
        text: helpText,
        contextInfo: {
          externalAdReply: {
            title: `${settings.botName || 'Mickey Glitch'} — Commands`,
            body: `v${settings.version || '?.?'}`,
            thumbnailUrl: BANNER,
            sourceUrl: 'https://github.com/Mickeydeveloper/Mickey-Glitch',
            mediaUrl: 'https://github.com/Mickeydeveloper/Mickey-Glitch',
            mediaType: 1,
            showAdAttribution: true,
            renderLargerThumbnail: true,
          },
        },
      }, { quoted: message });
    }

    // TTS greeting (non-blocking)
    sendTTSGreeting(sock, chatId, message).catch(console.error);

  } catch (error) {
    console.error('[help command] Error:', error);

    let errText = 'Unknown error';
    if (error instanceof Error) errText = error.message;
    else if (typeof error === 'string') errText = error;
    else errText = String(error);

    const reply = `*Error occurred while generating help:*\n\( {errText}\n\n \){FALLBACK_MSG}`;

    try {
      await sock.sendMessage(chatId, { text: reply }, { quoted: message });
    } catch (e2) {
      console.error('Failed to send error message too:', e2);
    }
  }
}

module.exports = helpCommand;