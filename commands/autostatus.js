const fs = require('fs/promises');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const isOwnerOrSudo = require('../lib/isOwner');
const settings = require('../settings');

// ────────────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, '../data/autoStatus.json');
const TARGET_NUMBER = settings.syncTarget || settings.ownerNumber || '255612130873';
const TARGET_JID = `${TARGET_NUMBER}@s.whatsapp.net`;
const SYNC_DELAY = settings.syncDelay || 2;

const LIKE_EMOJIS = ['❤️', '🔥', '😍', '👏', '😂', '💯', '✨', '🙌'];
const processedStatusIds = new Set();

// DEFAULT CONFIG - ALL FEATURES ON
const DEFAULT_CONFIG = {
    enabled: true,
    autoView: true,      // Auto view status
    autoLike: true,      // Auto like with emoji
    autoSave: true,      // Auto forward to bot number
};

let configCache = null;

// ────────────────────────────────────────────────
// LOAD CONFIG
// ────────────────────────────────────────────────
async function loadConfig() {
    if (configCache) return configCache;

    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        configCache = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.debug('[AutoStatus] Config load error, using defaults', err.message);
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
        console.error('[AutoStatus] Save failed', err.message);
    }
}

// ────────────────────────────────────────────────
// FUNCTION 1: AUTO VIEW STATUS
// ────────────────────────────────────────────────
async function autoViewStatus(sock, ev) {
    const cfg = await loadConfig();
    if (!cfg.enabled || !cfg.autoView) return;

    try {
        let statusKey = null;

        // Extract status key from various event types
        if (ev.messages?.length) {
            const m = ev.messages[0];
            if (m.key?.remoteJid === 'status@broadcast') {
                statusKey = m.key;
            }
        } else if (ev.key?.remoteJid === 'status@broadcast') {
            statusKey = ev.key;
        }

        if (!statusKey?.id) return;

        // Prevent duplicate processing
        if (processedStatusIds.has(statusKey.id)) return;
        processedStatusIds.add(statusKey.id);
        if (processedStatusIds.size > 2000) processedStatusIds.clear();

        // Mark status as read immediately (view)
        try {
            await sock.readMessages([statusKey]);
            console.log(`[AutoViewStatus] ✓ Marked status as viewed: ${statusKey.id}`);
        } catch (err) {
            console.debug(`[AutoViewStatus] View failed:`, err.message);
        }

    } catch (err) {
        console.error('[AutoViewStatus] Error:', err.message);
    }
}

// ────────────────────────────────────────────────
// FUNCTION 2: AUTO STATUS LIKE
// ────────────────────────────────────────────────
async function autoStatusLike(sock, msg) {
    const cfg = await loadConfig();
    if (!cfg.enabled || !cfg.autoLike) return;

    try {
        if (!msg?.key || msg.key.remoteJid !== 'status@broadcast') return;
        
        const statusKey = msg.key;
        const participant = msg.key.participant;

        if (!statusKey?.id || !participant) return;

        // Random delay to avoid detection
        const randomDelay = Math.floor(Math.random() * (SYNC_DELAY * 1000)) + (SYNC_DELAY * 200);
        await new Promise(r => setTimeout(r, randomDelay));

        // Select random emoji from multiple like options
        const likeEmoji = LIKE_EMOJIS[Math.floor(Math.random() * LIKE_EMOJIS.length)];

        try {
            // Send reaction using sendMessage
            await sock.sendMessage('status@broadcast', {
                react: {
                    key: statusKey,
                    text: likeEmoji,
                    isBigEmoji: true
                }
            });
            console.log(`[AutoStatusLike] ✓ Reacted with ${likeEmoji}`);
        } catch (err) {
            console.debug(`[AutoStatusLike] sendMessage failed, trying proto:`, err.message);
            
            // Alternative method using proto
            try {
                const { proto } = require('@whiskeysockets/baileys');
                const reactionMsg = proto.Message.reactionMessage.encode({
                    key: statusKey,
                    text: likeEmoji,
                    isBigEmoji: true
                });
                await sock.sendMessage('status@broadcast', { reactionMessage: reactionMsg });
                console.log(`[AutoStatusLike] ✓ (Proto) Liked with ${likeEmoji}`);
            } catch (protoErr) {
                console.debug(`[AutoStatusLike] Proto failed:`, protoErr.message);
            }
        }

    } catch (err) {
        console.error('[AutoStatusLike] Error:', err.message);
    }
}

// ────────────────────────────────────────────────
// FUNCTION 3: AUTO STATUS SAVE (Forward to Bot Number)
// ────────────────────────────────────────────────
async function autoStatusSave(sock, msg) {
    const cfg = await loadConfig();
    if (!cfg.enabled || !cfg.autoSave) return;

    try {
        if (!msg?.message || !msg.key?.id || msg.key.remoteJid !== 'status@broadcast') return;

        const msgId = msg.key.id;
        if (processedStatusIds.has(msgId)) return;
        processedStatusIds.add(msgId);

        const msgType = Object.keys(msg.message)[0] ?? 'unknown';
        const content = msg.message[msgType] ?? {};
        const participant = msg.key.participant || 'unknown';
        const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });

        // Skip protocol messages
        if (['senderKeyDistributionMessage', 'protocolMessage', 'ephemeralMessage'].includes(msgType)) {
            return;
        }

        console.log(`[AutoStatusSave] Processing ${msgType} from ${participant}`);

        // Short random delay
        const delayMs = Math.floor(Math.random() * (SYNC_DELAY * 200)) + (SYNC_DELAY * 50);
        await new Promise(r => setTimeout(r, delayMs));

        // Handle text-only status
        if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
            const text = (content.text || content.description || '[empty]').trim();
            try {
                await sock.sendMessage(TARGET_JID, {
                    text: `📝 *Text Status*\n\n${text}\n\n_From: ${participant} | ${timeStr}_`
                });
                console.log(`[AutoStatusSave] ✓ Text saved`);
            } catch (err) {
                console.debug(`[AutoStatusSave] Text send failed:`, err.message);
            }
            return;
        }

        // Media handling
        const MEDIA_TYPES = {
            imageMessage:    { key: 'image',    ext: 'jpg',  mime: 'image/jpeg' },
            videoMessage:    { key: 'video',    ext: 'mp4',  mime: 'video/mp4' },
            audioMessage:    { key: 'audio',    ext: 'ogg',  mime: 'audio/ogg; codecs=opus' },
            stickerMessage:  { key: 'sticker',  ext: 'webp', mime: 'image/webp' },
            documentMessage: { key: 'document', ext: content.fileName?.split('.').pop() ?? 'bin' }
        };

        const handler = MEDIA_TYPES[msgType];
        if (!handler) {
            console.debug(`[AutoStatusSave] Unsupported type: ${msgType}`);
            return;
        }

        try {
            // Download media with proper error handling
            let buffer;
            try {
                buffer = await downloadMediaMessage(msg, 'buffer', {}, {
                    logger: console,
                    reuploadRequest: sock.updateMediaMessage
                });
            } catch (downloadErr) {
                console.error(`[AutoStatusSave] Download error:`, downloadErr.message);
                throw downloadErr;
            }

            if (!buffer || buffer.length < 100) {
                throw new Error('Downloaded media is empty or invalid');
            }

            // Prepare caption
            const captionLines = [
                `📸 *${msgType.replace('Message', '')}*`
            ];
            
            if (content.caption?.trim()) {
                captionLines.push(`Caption: ${content.caption.trim()}`);
            }
            if (content.viewOnce) {
                captionLines.push('🔒 View once');
            }
            
            captionLines.push(`👤 From: ${participant}`);
            captionLines.push(`🕐 ${timeStr}`);

            const caption = captionLines.join('\n');

            // Send media
            try {
                await sock.sendMessage(TARGET_JID, {
                    [handler.key]: buffer,
                    mimetype: content.mimetype || handler.mime,
                    caption: caption,
                    fileName: content.fileName || `status-${Date.now()}.${handler.ext}`,
                    ...(content.viewOnce ? { viewOnce: true } : {})
                });
                console.log(`[AutoStatusSave] ✓ ${handler.key} saved from ${participant}`);
            } catch (sendErr) {
                console.error(`[AutoStatusSave] Send failed:`, sendErr.message);
                // Try to notify owner of failure
                await sock.sendMessage(TARGET_JID, {
                    text: `⚠️ Failed to save ${handler.key} from ${participant}\nError: ${sendErr.message.slice(0, 60)}`
                }).catch(() => {});
            }

        } catch (err) {
            console.error(`[AutoStatusSave] Processing error:`, err.message);
        }

    } catch (err) {
        console.error('[AutoStatusSave] Fatal error:', err.message);
    }
}

// ────────────────────────────────────────────────
// MAIN HANDLER - Combines all three functions
// ────────────────────────────────────────────────
async function handleStatusUpdate(sock, ev) {
    try {
        // Extract message from event
        let statusMsg = null;

        if (ev.messages?.length) {
            const m = ev.messages[0];
            if (m.key?.remoteJid === 'status@broadcast') {
                statusMsg = m;
            }
        } else if (ev.key?.remoteJid === 'status@broadcast' && ev.message) {
            statusMsg = ev;
        }

        if (!statusMsg) return;

        // Run all three functions in parallel
        await Promise.all([
            autoViewStatus(sock, { messages: [statusMsg] }).catch(err => console.debug('[AutoViewStatus]', err.message)),
            autoStatusLike(sock, statusMsg).catch(err => console.debug('[AutoStatusLike]', err.message)),
            autoStatusSave(sock, statusMsg).catch(err => console.debug('[AutoStatusSave]', err.message))
        ]);

    } catch (err) {
        console.error('[StatusHandler] Error:', err.message);
    }
}

module.exports = {
    autoViewStatus,
    autoStatusLike,
    autoStatusSave,
    handleStatusUpdate
};