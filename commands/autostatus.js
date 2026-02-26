const fs = require('fs/promises');
const path = require('path');

const isOwnerOrSudo = require('../lib/isOwner');

// ────────────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, '../data/autoStatus.json');

const DEFAULT_CONFIG = Object.freeze({
    viewEnabled: true,      // Auto view/read status
    likeEnabled: true,      // Auto like/react with random emoji
});

const EMOJI_REACTIONS = ['❤️', '🔥', '😂', '😱', '👍', '🎉', '😍', '💯', '🙏', '😢', '🤔', '👌'];

let configCache = null;
const processedStatusIds = new Set();

// ────────────────────────────────────────────────
async function loadConfig() {
    if (configCache) return configCache;

    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        configCache = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (err) {
        console.error('[AutoStatus] Config load error → using defaults', err.message);
        configCache = { ...DEFAULT_CONFIG };
        await saveConfig(configCache); // ensure file exists with defaults
    }
    return configCache;
}

async function saveConfig(updates) {
    configCache = { ...configCache, ...updates };
    try {
        await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
        await fs.writeFile(CONFIG_FILE, JSON.stringify(configCache, null, 2), 'utf8');
        console.log('[AutoStatus] Config saved');
    } catch (err) {
        console.error('[AutoStatus] Save failed:', err.message);
    }
}

// ────────────────────────────────────────────────
function randomMs(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomEmoji() {
    return EMOJI_REACTIONS[Math.floor(Math.random() * EMOJI_REACTIONS.length)];
}

// ────────────────────────────────────────────────
// AUTO VIEW - Mark status as read
async function autoView(sock, statusKey) {
    if (!statusKey?.id) return;

    try {
        await sock.readMessages([statusKey]);
        console.log(`[AutoStatus] Viewed status → ${statusKey.id}`);
    } catch (err) {
        console.error(`[AutoView] Failed:`, err.message);
    }
}

// ────────────────────────────────────────────────
// AUTO LIKE - React with random emoji (2025–2026 correct format)
async function autoLike(sock, statusKey) {
    if (!statusKey?.id || !statusKey?.participant) return;

    const emoji = getRandomEmoji();
    const participantJid = statusKey.participant;

    try {
        // Random delay to look natural & avoid rate limits
        await new Promise(r => setTimeout(r, randomMs(1200, 3500)));

        await sock.sendMessage('status@broadcast', {
            react: {
                text: emoji,
                key: statusKey
            }
        }, {
            statusJidList: [participantJid]   // Critical: without this, reaction often fails silently on status
        });

        console.log(`[AutoStatus] Reacted with ${emoji} to status → ${statusKey.id}`);
    } catch (err) {
        console.error(`[AutoLike] Failed:`, err.message || err);
    }
}

// ────────────────────────────────────────────────
// Main handler for status events
async function handleStatusUpdate(sock, ev) {
    const cfg = await loadConfig();

    let statusKey = null;

    // Normalize event shape (messages.upsert or other)
    if (ev.messages?.[0]?.key?.remoteJid === 'status@broadcast') {
        statusKey = ev.messages[0].key;
    } else if (ev.key?.remoteJid === 'status@broadcast') {
        statusKey = ev.key;
    }

    if (!statusKey?.id) return;

    // Deduplication (prevent spam)
    if (processedStatusIds.has(statusKey.id)) {
        console.log(`[AutoStatus] Already processed → ${statusKey.id}`);
        return;
    }
    processedStatusIds.add(statusKey.id);

    // Limit memory usage
    if (processedStatusIds.size > 1500) {
        const recent = Array.from(processedStatusIds).slice(-750);
        processedStatusIds.clear();
        recent.forEach(id => processedStatusIds.add(id));
    }

    console.log(`[AutoStatus] New status detected → ${statusKey.id} from ${statusKey.participant || 'unknown'}`);

    // Auto View
    if (cfg.viewEnabled) {
        await autoView(sock, statusKey);
    }

    // Auto Like / Reaction
    if (cfg.likeEnabled) {
        await autoLike(sock, statusKey);
    }
}

// ────────────────────────────────────────────────
// COMMAND HANDLER (unchanged but with better defaults message)
async function autoStatusCommand(sock, chatId, msg, args = []) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const isAllowed = msg.key.fromMe || (await isOwnerOrSudo(sender, sock, chatId));

    if (!isAllowed) {
        return sock.sendMessage(chatId, { text: '⛔ Owner/sudo only' });
    }

    const cfg = await loadConfig();

    if (!args.length) {
        return sock.sendMessage(chatId, {
            text: `🟢 *Auto Status Manager* (defaults: always ON)\n\n` +
                  `View Status  : ${cfg.viewEnabled ? '✅ ON' : '❌ OFF'}\n` +
                  `Like Status  : ${cfg.likeEnabled ? '✅ ON' : '❌ OFF'}\n\n` +
                  `Commands:\n` +
                  `  .autostatus view on/off\n` +
                  `  .autostatus like on/off\n` +
                  `  .autostatus status`
        });
    }

    const cmd = args[0].toLowerCase();

    if (cmd === 'view') {
        if (args.length < 2 || !['on','off'].includes(args[1].toLowerCase())) {
            return sock.sendMessage(chatId, { text: 'Usage: .autostatus view on/off' });
        }
        const value = args[1].toLowerCase() === 'on';
        await saveConfig({ viewEnabled: value });
        return sock.sendMessage(chatId, { text: `Auto view → ${value ? '✅ ON' : '❌ OFF'}` });
    }

    if (cmd === 'like') {
        if (args.length < 2 || !['on','off'].includes(args[1].toLowerCase())) {
            return sock.sendMessage(chatId, { text: 'Usage: .autostatus like on/off' });
        }
        const value = args[1].toLowerCase() === 'on';
        await saveConfig({ likeEnabled: value });
        return sock.sendMessage(chatId, { text: `Auto like → ${value ? '✅ ON (random emoji)' : '❌ OFF'}` });
    }

    if (cmd === 'status') {
        return sock.sendMessage(chatId, {
            text: `Current config:\n\`\`\`${JSON.stringify(cfg, null, 2)}\`\`\``
        });
    }

    return sock.sendMessage(chatId, { text: 'Unknown subcommand. Use .autostatus' });
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate,
    autoLike,
    autoView
};