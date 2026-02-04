// help.js
// ──────────────────────────────────────────────────────────────
//  Help – Dynamic Command Menu + TTS Greeting
// ──────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const os = require('os');
const settings = require('../settings');
const gTTS = require('gtts');
const chalk = require('chalk');

const EXCLUDE = ['help']; 
const BANNER = 'https://water-billimg.onrender.com/1761205727440.png';

/**
 * Gets the actual path to the commands folder
 */
const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

async function getBestDisplayName(sock, message) {
  try {
    const jid = message?.key?.participant || message?.key?.remoteJid || '';
    if (message?.pushName) return message.pushName;
    return jid.split('@')[0] || 'User';
  } catch {
    return 'User';
  }
}

function getUptime() {
  const sec = process.uptime();
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

function getCommandDescription(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split(/\r?\n/).slice(0, 5);
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('//')) return t.replace(/^\/\/\s*/, '').trim();
      if (t.startsWith('/*')) return t.replace(/^\/\*\s*/, '').replace(/\*\/$/, '').trim();
    }
  } catch {}
  return 'No description available';
}

/**
 * Reads the actual commands folder with console output
 */
function listCommandFiles() {
  try {
    if (!fs.existsSync(COMMANDS_DIR)) {
      console.log(chalk.red('❌ Commands directory not found'));
      return [];
    }

    console.log(chalk.cyan('📂 Scanning commands directory...'));
    
    const files = fs.readdirSync(COMMANDS_DIR).filter(file => file.endsWith('.js'));
    console.log(chalk.blue(`📋 Found ${files.length} command files`));

    let loadedCount = 0;
    const commands = files
      .map(file => {
        const name = path.basename(file, '.js');
        const fp = path.join(COMMANDS_DIR, file);
        const cmd = {
          name,
          desc: getCommandDescription(fp),
        };
        loadedCount++;
        // Show progress every 10 commands
        if (loadedCount % 10 === 0) {
          console.log(chalk.yellow(`  ⏳ Loaded ${loadedCount}/${files.length} commands...`));
        }
        return cmd;
      })
      .filter(cmd => !EXCLUDE.includes(cmd.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(chalk.green(`✅ Successfully loaded ${commands.length} commands (${files.length - commands.length} excluded)\n`));
    return commands;
  } catch (err) {
    console.error(chalk.red("❌ Error reading commands folder:"), err.message);
    return [];
  }
}

function buildHelpMessage(commands, opts = {}) {
  const {
    runtime = getUptime(),
    mode = settings.commandMode || 'Public',
    prefix = settings.prefix || '.',
    ramUsed = '?',
    ramTotal = '?',
    name = 'User',
  } = opts;

  let menu = `╭━━━〔 *${settings.botName || 'MICKEY GLITCH'}* 〕━━━┈⊷\n`;
  menu += `┃ 👑 *Owner:* ${settings.botOwner || 'Mickey'}\n`;
  menu += `┃ 👤 *User:* ${name}\n`;
  menu += `┃ ⏲️ *Uptime:* ${runtime}\n`;
  menu += `┃ 🛡️ *Mode:* ${mode}\n`;
  menu += `┃ 🧩 *Prefix:* [ ${prefix} ]\n`;
  menu += `┃ 🧠 *RAM:* ${ramUsed}GB / ${ramTotal}GB\n`;
  menu += `╰━━━━━━━━━━━━━━━━━━┈⊷\n\n`;

  menu += `╭━━━〔 *COMMAND LIST* 〕━━━┈⊷\n`;
  
  commands.forEach((cmd) => {
    menu += `┃ ◈ \`${prefix}${cmd.name}\`\n`;
    menu += `┃ ╰┈ *${cmd.desc}*\n`;
  });

  menu += `╰━━━━━━━━━━━━━━━━━━┈⊷\n`;
  menu += `*Total:* ${commands.length} Commands`;

  return menu;
}

async function sendTTSGreeting(sock, chatId, message) {
  try {
    console.log(chalk.yellow('  ⏳ Getting user display name...'));
    const displayName = await getBestDisplayName(sock, message);
    
    const greeting = `Hello ${displayName}! I'm ${settings.botName}, your personal WhatsApp assistant. Here are all my available commands. Please use them responsibly and help keep our community safe and positive. Enjoy!`;
    
    console.log(chalk.yellow('  ⏳ Creating temp directory for audio...'));
    const assetsDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);
    
    const filepath = path.join(assetsDir, `tts-${Date.now()}.mp3`);
    
    console.log(chalk.yellow('  ⏳ Generating TTS audio file...'));
    const gtts = new gTTS(greeting, 'en');

    await new Promise((resolve, reject) => {
      gtts.save(filepath, err => (err ? reject(err) : resolve()));
    });
    
    console.log(chalk.yellow('  ⏳ Sending audio message...'));
    await sock.sendMessage(chatId, {
      audio: { url: filepath },
      mimetype: 'audio/mpeg',
      ptt: true,
    }, { quoted: message });

    setTimeout(() => fs.unlinkSync(filepath), 5000);
  } catch (err) {
    console.error(chalk.red('❌ TTS Error:'), err.message);
  }
}

async function helpCommand(sock, chatId, message) {
  try {
    console.log(chalk.cyan('📖 Help command requested'));
    console.log(chalk.yellow('  ⏳ Generating help menu...'));

    const memUsed = (process.memoryUsage().rss / 1024 ** 3).toFixed(2);
    const memTotal = (os.totalmem() / 1024 ** 3).toFixed(2);
    const displayName = await getBestDisplayName(sock, message);
    
    console.log(chalk.yellow('  ⏳ Loading all available commands...'));
    const commands = listCommandFiles();
    
    console.log(chalk.yellow('  ⏳ Building help message...'));
    const helpText = buildHelpMessage(commands, {
      ramUsed: memUsed,
      ramTotal: memTotal,
      name: displayName,
    });

    console.log(chalk.yellow('  ⏳ Sending help message...'));
    await sock.sendMessage(chatId, {
      text: helpText,
      contextInfo: {
        externalAdReply: {
          title: `${settings.botName} v${settings.version || '1.0'}`,
          body: `Created by ${settings.botOwner}`,
          thumbnailUrl: BANNER,
          sourceUrl: 'https://github.com/Mickeydeveloper',
          mediaType: 1,
          renderLargerThumbnail: true,
        },
      },
    }, { quoted: message });
    console.log(chalk.green('✅ Help menu sent'));

    // Send greeting
    console.log(chalk.yellow('  ⏳ Generating TTS greeting...'));
    await sendTTSGreeting(sock, chatId, message);
    console.log(chalk.green('✅ TTS greeting sent\n'));

  } catch (error) {
    console.error(chalk.red('❌ Help Command Error:'), error.message);
    await sock.sendMessage(chatId, { text: "Error generating help menu." });
  }
}

module.exports = helpCommand;
