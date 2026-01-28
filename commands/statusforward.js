const fs = require('fs/promises');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const isOwnerOrSudo = require('../lib/isOwner');
const settings = require('../settings');

// ────────────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, '../data/statusforward.json');
const SYNC_DELAY = settings.syncDelay || 6;
let BOT_NUMBER = null;
let TARGET_JID = null;

const DEFAULT_CONFIG = Object.freeze({
    enabled: true,
    forwardDelayMinMs: SYNC_DELAY * 250,
    forwardDelayMaxMs: SYNC_DELAY * 500,
});

let configCache = null;
const processedStatusIds = new Set();

// ────────────────────────────────────────────────
async function loadConfig() {
    if (configCache) return configCache;

    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        configCache = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error('[StatusForward] Config load error → defaults', err.message);
        }
        configCache = { ...DEFAULT_CONFIG };
        await saveConfig(configCache);
    }
    return configCache;
}

async function saveConfig(updates) {
    configCache = { ...configCache, ...updates };
    try {
        await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
        await fs.writeFile(CONFIG_FILE, JSON.stringify(configCache, null, 2));
    } catch (err) {
        console.error('[StatusForward] Save failed', err.message);
    }
}

// ────────────────────────────────────────────────
function extractPhoneNumber(key) {
    if (!key) return 'unknown';
    const jid = key.participant || key.remoteJid || '';
    const match = jid.match(/^(\d{9,15})/);
    return match ? match[1] : 'unknown';
}

function getTimeStr() {
    return new Date().toLocaleString('en-GB', {
        timeZone: 'Africa/Dar_es_Salaam',
        dateStyle: 'short',
        timeStyle: 'medium'
    });
}

function randomMs(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ────────────────────────────────────────────────
// FORWARD STATUS FUNCTION
async function forwardStatus(sock, msg) {
    if (!msg?.message || !msg.key?.id) return;
    if (!TARGET_JID) {
        // Auto-set bot number on first use
        const botId = sock.user?.id;
        if (botId) {
            BOT_NUMBER = botId.split(':')[0];
            TARGET_JID = `${BOT_NUMBER}@s.whatsapp.net`;
        } else {
            console.warn('[StatusForward] Bot ID not available yet');
            return;
        }
    }

    const msgId = msg.key.id;
    if (processedStatusIds.has(msgId)) return;
    processedStatusIds.add(msgId);
    if (processedStatusIds.size > 1200) processedStatusIds.clear();

    const phone = extractPhoneNumber(msg.key);
    const msgType = Object.keys(msg.message)[0] ?? 'unknown';
    const content = msg.message[msgType] ?? {};
    const timeStr = getTimeStr();

    // Skip useless protocol/control messages
    if (['senderKeyDistributionMessage', 'protocolMessage', 'ephemeralMessage'].includes(msgType) &&
        !content.caption && !msg.message.imageMessage && !msg.message.videoMessage) {
        return;
    }

    console.log(`📸 [Forward] ${phone} • ${msgType} • ${timeStr}`);

    // Info header
    await sock.sendMessage(TARGET_JID, {
        text: `📸 New status from *${phone}* (${msgType})`
    }).catch(() => {});

    await new Promise(r => setTimeout(r, randomMs(700, 1400)));

    // Text-only status
    if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
        const text = (content.text || content.description || '[empty text]').trim();
        await sock.sendMessage(TARGET_JID, {
            text: `${text}\n\n🕒 ${timeStr} • from ${phone}`
        }).catch(() => {});
        return;
    }

    // Media types mapping
    const MEDIA_TYPES = {
        imageMessage:    { key: 'image',    ext: 'jpg',  mime: 'image/jpeg'   },
        videoMessage:    { key: 'video',    ext: 'mp4',  mime: 'video/mp4'    },
        audioMessage:    { key: 'audio',    ext: 'ogg',  mime: 'audio/ogg; codecs=opus' },
        stickerMessage:  { key: 'sticker',  ext: 'webp', mime: 'image/webp'   },
        documentMessage: { key: 'document', ext: content.fileName?.split('.').pop() ?? 'bin' }
    };

    const handler = MEDIA_TYPES[msgType];
    if (!handler) {
        console.debug(`[Skipped] Unsupported type → ${msgType}`);
        return;
    }

    try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
            logger: console,
            reuploadRequest: sock.updateMediaMessage
        });

        if (!buffer || buffer.length < 200) {
            throw new Error('Downloaded media is empty/corrupt');
        }

        const caption = [
            content.caption?.trim() ? `Caption: ${content.caption.trim()}` : '',
            content.viewOnce ? '🔒 View once' : '',
            `🕒 ${timeStr} • from ${phone}`
        ].filter(Boolean).join('\n');

        await sock.sendMessage(TARGET_JID, {
            [handler.key]: buffer,
            mimetype: content.mimetype || handler.mime,
            caption: caption || undefined,
            fileName: content.fileName || `status-${Date.now()}.${handler.ext}`,
            ...(content.viewOnce ? { viewOnce: true } : {})
        });

        console.log(`✅ [Forward OK] ${handler.key}`);
    } catch (err) {
        console.error('[Forward FAIL]', err.message || err);
        await sock.sendMessage(TARGET_JID, {
            text: `⚠️ Could not forward ${msgType} from ${phone}\nError: ${err.message.slice(0, 80)}\n🕒 ${timeStr}`
        }).catch(() => {});
    }
}

// ────────────────────────────────────────────────
// Handle status forwarding
async function handleStatusForward(sock, ev) {
    // Auto-set bot number on first use
    if (!TARGET_JID) {
        const botId = sock.user?.id;
        if (botId) {
            BOT_NUMBER = botId.split(':')[0];
            TARGET_JID = `${BOT_NUMBER}@s.whatsapp.net`;
        } else {
            return; // Not connected yet
        }
    }

    const cfg = await loadConfig();
    if (!cfg.enabled) return;

    let statusMsg = null;

    if (ev.messages?.length) {
        const m = ev.messages[0];
        if (m.key?.remoteJid === 'status@broadcast' && m.message) {
            statusMsg = m;
        }
    }

    if (!statusMsg) return;

    try {
        await new Promise(r => setTimeout(r, randomMs(cfg.forwardDelayMinMs, cfg.forwardDelayMaxMs)));
        await forwardStatus(sock, statusMsg);
    } catch (err) {
        console.error('[StatusForward] Error', err?.message || err);
    }
}

// ────────────────────────────────────────────────
// COMMAND HANDLER
async function statusForwardCommand(sock, chatId, msg, args = []) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const isAllowed = msg.key.fromMe || (await isOwnerOrSudo(sender, sock, chatId));

    if (!isAllowed) {
        return sock.sendMessage(chatId, { text: '⛔ Owner/sudo only' });
    }

    // Auto-set bot number on first use
    if (!TARGET_JID) {
        const botId = sock.user?.id;
        if (botId) {
            BOT_NUMBER = botId.split(':')[0];
            TARGET_JID = `${BOT_NUMBER}@s.whatsapp.net`;
        }
    }

    const cfg = await loadConfig();

    if (!args.length) {
        return sock.sendMessage(chatId, {
            text: `📤 *Status Forward Manager* (Auto sync to bot number)\n\n` +
                  `Forward Status : ${cfg.enabled ? '✅ ON' : '❌ OFF'}\n` +
                  `Bot Number     : ${BOT_NUMBER || 'detecting...'}\n\n` +
                  `Commands:\n` +
                  `  .statusforward on\n` +
                  `  .statusforward off\n` +
                  `  .statusforward status`
        });
    }

    const cmd = args[0].toLowerCase();

    if (cmd === 'on') {
        await saveConfig({ enabled: true });
        return sock.sendMessage(chatId, { text: '✅ Status forwarding → ON (syncing to bot number)' });
    }

    if (cmd === 'off') {
        await saveConfig({ enabled: false });
        return sock.sendMessage(chatId, { text: '❌ Status forwarding → OFF' });
    }

    if (cmd === 'status') {
        return sock.sendMessage(chatId, {
            text: `Current config:\n\`\`\`${JSON.stringify(cfg, null, 2)}\`\`\`\n\nBot auto-syncs to: ${BOT_NUMBER || 'detecting...'}`
        });
    }

    return sock.sendMessage(chatId, { text: 'Unknown subcommand. Try .statusforward' });
}

module.exports = {
    statusForwardCommand,
    handleStatusForward
};