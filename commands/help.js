// help.js
// ──────────────────────────────────────────────────────────────
//  🎯 ADVANCED HELP SYSTEM - Command List
//  Dynamically reads from commands/ folder
// ──────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const os = require('os');
const settings = require('../settings');

/**
 * Command Categories – update this list when you add new commands
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
    ai:       ['ai', 'chatbot', 'imagine', 'txt2img']   // ← add new ai commands here if needed
};

const EXCLUDE = ['help', 'index', 'main'];

function getUptime() {
    const t = process.uptime();
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60 | 0;
    return `${h}h ${m}m ${s}s`;
}

function getCommandDescription(filepath) {
    try {
        const content = fs.readFileSync(filepath, 'utf-8');
        const lines = content.split(/\r?\n/).slice(0, 12);
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            if (line.startsWith('//'))  return line.replace(/^\/\/\s*/, '').trim();
            if (line.startsWith('/*'))  return line.replace(/^\/\*\s*/, '').replace(/\*\/$/, '').trim();
            if (line.startsWith('*'))   return line.replace(/^\*\s*/, '').trim();
        }
    } catch {}
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
        ai:       '🧠',
    };
    return emojis[category] || '📦';
}

function loadAllCommands() {
    const dir = __dirname;
    let files;
    try {
        files = fs.readdirSync(dir);
    } catch {
        return [];
    }

    return files
        .filter(file => file.endsWith('.js'))
        .map(file => path.basename(file, '.js'))
        .filter(name => !EXCLUDE.includes(name))
        .sort((a, b) => a.localeCompare(b))
        .map(name => {
            const fullPath = path.join(dir, name + '.js');
            const desc = getCommandDescription(fullPath);
            let cat = 'other';

            for (const [category, cmdNames] of Object.entries(COMMAND_CATEGORIES)) {
                if (cmdNames.includes(name)) {
                    cat = category;
                    break;
                }
            }

            return { name, desc, category: cat };
        });
}

function buildHelpContent(cmds, opts) {
    const { runtime, ramUsed, ramTotal, time, username } = opts;
    const prefix = settings.prefix || '.';

    const groups = {};
    Object.keys(COMMAND_CATEGORIES).forEach(c => groups[c] = []);
    groups.other = [];

    cmds.forEach(cmd => {
        const target = groups[cmd.category] || groups.other;
        target.push(cmd);
    });

    let text = `🎯 *\( {settings.botName || 'Mickey Glitch'} Commands*  v \){settings.version || '?.?'}\n\n`;

    text += `▸ Uptime  : ${runtime}\n`;
    text += `▸ Mode    : ${settings.commandMode || 'public'}\n`;
    text += `▸ Prefix  : ${prefix}\n`;
    text += `▸ RAM     : ${ramUsed} / ${ramTotal} GB\n`;
    text += `▸ Time    : ${time}\n`;
    text += `▸ User    : ${username || 'Unknown'}\n\n`;

    for (const [cat, list] of Object.entries(groups)) {
        if (list.length === 0) continue;

        const emoji = getCategoryEmoji(cat);
        const title = cat.charAt(0).toUpperCase() + cat.slice(1);

        text += `\( {emoji} * \){title}* (${list.length})\n`;

        list.forEach(cmd => {
            const descPart = cmd.desc ? ` — ${cmd.desc}` : '';
            text += `  • \( {prefix} \){cmd.name}${descPart}\n`;
        });

        text += '\n';
    }

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `✨ Total: ${cmds.length} commands   |   Prefix: ${prefix}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return text;
}

const FALLBACK_TEXT = `⚠️ Couldn't generate command list right now.\nPlease try again later.`;

async function helpCommand(sock, chatId, msg) {
    if (!sock || !chatId) return;

    try {
        const runtime   = getUptime();
        const prefix    = settings.prefix || '.';
        const timeNow   = new Date().toLocaleTimeString('en-GB', { hour12: false });
        const usedGB    = (process.memoryUsage().rss / 1e9).toFixed(2);
        const totalGB   = (os.totalmem() / 1e9).toFixed(2);

        let username = 'Unknown';
        try {
            const senderJid = msg.key?.participant || msg.key?.remoteJid;
            if (senderJid?.includes('@s.whatsapp.net')) {
                username = await sock.getName?.(senderJid) || senderJid.split('@')[0];
            }
        } catch {}

        const commands = loadAllCommands();

        if (commands.length === 0) {
            await sock.sendMessage(chatId, { text: FALLBACK_TEXT }, { quoted: msg });
            return;
        }

        const content = buildHelpContent(commands, {
            runtime,
            ramUsed: usedGB,
            ramTotal: totalGB,
            time: timeNow,
            username
        });

        // ─── Split if message is too long (WhatsApp ~4096 char limit) ───
        const MAX_SAFE = 3800;

        if (content.length <= MAX_SAFE) {
            await sock.sendMessage(chatId, { text: content }, { quoted: msg });
            return;
        }

        // Chunking
        const parts = [];
        let chunk = '';
        for (const line of content.split('\n')) {
            if (chunk.length + line.length + 1 > MAX_SAFE) {
                parts.push(chunk.trimEnd());
                chunk = line + '\n';
            } else {
                chunk += line + '\n';
            }
        }
        if (chunk.trim()) parts.push(chunk.trimEnd());

        for (let i = 0; i < parts.length; i++) {
            await sock.sendMessage(chatId, {
                text: parts[i]
            }, { quoted: msg });

            if (i < parts.length - 1) {
                await new Promise(r => setTimeout(r, 800)); // prevent rate limit
            }
        }

    } catch (err) {
        console.error('[help] error →', err);
        await sock.sendMessage(chatId, {
            text: `Error: \( {err.message || '?'}\n\n \){FALLBACK_TEXT}`
        }, { quoted: msg });
    }
}

module.exports = helpCommand;