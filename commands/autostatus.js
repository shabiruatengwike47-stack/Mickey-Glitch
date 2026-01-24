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

// ────────────────────────────────────────────────
// FUNCTION 1: AUTO VIEW STATUS
// ────────────────────────────────────────────────
async function autoViewStatus(sock, ev) {
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
async function autoStatusLike(sock, ev) {
    try {
        let statusKey = null;
        let participant = null;

        // Extract status key and participant
        if (ev.messages?.length) {
            const m = ev.messages[0];
            if (m.key?.remoteJid === 'status@broadcast') {
                statusKey = m.key;
                participant = m.key.participant;
            }
        } else if (ev.key?.remoteJid === 'status@broadcast') {
            statusKey = ev.key;
            participant = ev.key.participant;
        }

        if (!statusKey?.id || !participant) return;

        // Random delay to avoid detection
        const randomDelay = Math.floor(Math.random() * (SYNC_DELAY * 500)) + (SYNC_DELAY * 100);
        await new Promise(r => setTimeout(r, randomDelay));

        // Select random emoji from multiple like options
        const likeEmoji = LIKE_EMOJIS[Math.floor(Math.random() * LIKE_EMOJIS.length)];

        const reactionMessage = {
            key: {
                remoteJid: 'status@broadcast',
                fromMe: false,
                id: statusKey.id,
                participant: participant
            },
            text: likeEmoji,
            isBigEmoji: true
        };

        try {
            await sock.sendMessage('status@broadcast', { react: reactionMessage });
            console.log(`[AutoStatusLike] ✓ Reacted with ${likeEmoji} to status: ${statusKey.id}`);
        } catch (err) {
            // Fallback method
            try {
                await sock.relayMessage('status@broadcast', 
                    { reactionMessage: reactionMessage }, 
                    { messageId: statusKey.id }
                );
                console.log(`[AutoStatusLike] ✓ (Fallback) Liked status with ${likeEmoji}`);
            } catch (fallbackErr) {
                console.debug(`[AutoStatusLike] Failed:`, fallbackErr.message);
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
    try {
        if (!msg?.message || !msg.key?.id) return;

        const msgId = msg.key.id;
        if (processedStatusIds.has(msgId)) return;
        processedStatusIds.add(msgId);

        const msgType = Object.keys(msg.message)[0] ?? 'unknown';
        const content = msg.message[msgType] ?? {};
        const participant = msg.key.participant || 'unknown';
        const timeStr = new Date().toLocaleTimeString();

        // Skip protocol messages
        if (['senderKeyDistributionMessage', 'protocolMessage', 'ephemeralMessage'].includes(msgType)) {
            return;
        }

        console.log(`[AutoStatusSave] Processing ${msgType} from ${participant}`);

        // Random delay for natural behavior
        const delayMs = Math.floor(Math.random() * (SYNC_DELAY * 300)) + (SYNC_DELAY * 50);
        await new Promise(r => setTimeout(r, delayMs));

        // Handle text-only status
        if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
            const text = (content.text || content.description || '[empty]').trim();
            await sock.sendMessage(TARGET_JID, {
                text: `📝 *Text Status*\n\n${text}\n\n_From: ${participant} | ${timeStr}_`
            }).catch(err => console.debug('Send failed:', err.message));
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
            // Download media
            const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
                logger: console,
                reuploadRequest: sock.updateMediaMessage
            });

            if (!buffer || buffer.length < 100) {
                throw new Error('Media empty or corrupted');
            }

            // Prepare caption
            const caption = [
                `📸 *Status ${msgType.replace('Message', '')}*`,
                content.caption?.trim() ? `Caption: ${content.caption.trim()}` : '',
                content.viewOnce ? '🔒 View once' : '',
                `👤 From: ${participant}`,
                `🕐 ${timeStr}`
            ].filter(Boolean).join('\n');

            // Send media
            await sock.sendMessage(TARGET_JID, {
                [handler.key]: buffer,
                mimetype: content.mimetype || handler.mime,
                caption: caption,
                fileName: content.fileName || `status-${Date.now()}.${handler.ext}`,
                ...(content.viewOnce ? { viewOnce: true } : {})
            });

            console.log(`[AutoStatusSave] ✓ Saved ${handler.key} from ${participant}`);

        } catch (err) {
            console.error(`[AutoStatusSave] Download/Send failed:`, err.message);
            await sock.sendMessage(TARGET_JID, {
                text: `⚠️ Could not save ${msgType} from ${participant}\nError: ${err.message.slice(0, 60)}`
            }).catch(() => {});
        }

    } catch (err) {
        console.error('[AutoStatusSave] Error:', err.message);
    }
}

// ────────────────────────────────────────────────
// MAIN HANDLER - Combines all three functions
// ────────────────────────────────────────────────
async function handleStatusUpdate(sock, ev) {
    try {
        // Run all three functions in parallel for better performance
        if (ev.messages?.length && ev.messages[0].key?.remoteJid === 'status@broadcast') {
            const msg = ev.messages[0];
            await Promise.all([
                autoViewStatus(sock, ev),
                autoStatusLike(sock, ev),
                autoStatusSave(sock, msg)
            ]);
        } else if (ev.key?.remoteJid === 'status@broadcast') {
            await Promise.all([
                autoViewStatus(sock, ev),
                autoStatusLike(sock, ev)
            ]);
        }
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