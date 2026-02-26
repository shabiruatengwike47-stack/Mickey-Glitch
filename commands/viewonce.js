const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// ────────────────────────────────────────────────
// CONFIGURABLE CONSTANTS (change these as needed)
const TARGET_MODE = 'owner';           // 'owner' or 'bot'
const OWNER_PHONE = '255615944741';    // ← CHANGE TO YOUR REAL NUMBER (without + or 00)
const NOTIFY_USER = false;             // true = send reply in the original chat, false = silent
// ────────────────────────────────────────────────

// Path to usage stats
const commandStatsFile = path.join(__dirname, '../data/commandStats.json');

function loadCommandStats() {
    try {
        if (fs.existsSync(commandStatsFile)) {
            return JSON.parse(fs.readFileSync(commandStatsFile, 'utf8'));
        }
    } catch (error) {
        console.error('[ViewOnce Stats] Load error:', error.message);
    }
    return { totalCommands: 0 };
}

function saveCommandStats(stats) {
    try {
        const dir = path.dirname(commandStatsFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(commandStatsFile, JSON.stringify(stats, null, 2), 'utf8');
    } catch (error) {
        console.error('[ViewOnce Stats] Save error:', error.message);
    }
}

function incrementCommandUsage(commandName = 'viewonce') {
    const stats = loadCommandStats();
    stats[commandName] = (stats[commandName] || 0) + 1;
    stats.totalCommands = (stats.totalCommands || 0) + 1;
    saveCommandStats(stats);
}

/**
 * viewonceCommand
 * Reply to view-once image/video/audio → bot downloads & forwards privately
 * Command: .viewonce (or your prefix)
 */
async function viewonceCommand(sock, chatId, message) {
    try {
        incrementCommandUsage('viewonce');

        // Must be a reply
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            if (NOTIFY_USER) {
                await sock.sendMessage(chatId, { text: '❌ Reply to a view-once media first.' }, { quoted: message });
            }
            return;
        }

        // Detect view-once media
        let media = null;
        let type = null;
        let mime = null;

        if (quoted.imageMessage?.viewOnce) {
            media = quoted.imageMessage;
            type = 'image';
            mime = media.mimetype || 'image/jpeg';
        } else if (quoted.videoMessage?.viewOnce) {
            media = quoted.videoMessage;
            type = 'video';
            mime = media.mimetype || 'video/mp4';
        } else if (quoted.audioMessage?.viewOnce) {
            media = quoted.audioMessage;
            type = 'audio';
            mime = media.mimetype || 'audio/ogg; codecs=opus';
        }

        if (!media) {
            if (NOTIFY_USER) {
                await sock.sendMessage(chatId, { text: '❌ Not a view-once image, video or audio.' }, { quoted: message });
            }
            return;
        }

        // Determine private target JID
        let targetJid = null;

        if (TARGET_MODE === 'bot' && sock?.user?.id) {
            targetJid = sock.user.id;
        } else if (OWNER_PHONE) {
            targetJid = `${OWNER_PHONE}@s.whatsapp.net`;
        }

        if (!targetJid) {
            console.error('[ViewOnce] No target JID configured');
            if (NOTIFY_USER) {
                await sock.sendMessage(chatId, { text: '❌ Target not set in code (owner phone missing).' }, { quoted: message });
            }
            return;
        }

        // Download
        const stream = await downloadContentFromMessage(media, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        if (buffer.length === 0) throw new Error('Empty buffer downloaded');

        // Prepare caption
        const caption = media.caption ? `Original: ${media.caption}` : `Forwarded view-once ${type}`;

        // Send privately
        let sent;
        if (type === 'image') {
            sent = await sock.sendMessage(targetJid, {
                image: buffer,
                mimetype: mime,
                caption,
                fileName: `viewonce_${Date.now()}.jpg`
            });
        } else if (type === 'video') {
            sent = await sock.sendMessage(targetJid, {
                video: buffer,
                mimetype: mime,
                caption,
                fileName: `viewonce_${Date.now()}.mp4`
            });
        } else if (type === 'audio') {
            sent = await sock.sendMessage(targetJid, {
                audio: buffer,
                mimetype: mime,
                ptt: media.ptt || false,
                caption,
                fileName: `viewonce_${Date.now()}.ogg`
            });
        }

        // Optional notification (silent by default)
        if (NOTIFY_USER) {
            await sock.sendMessage(chatId, {
                text: `✅ View-once ${type} forwarded privately.`
            }, { quoted: message });
        }

        console.log(`[ViewOnce] Forwarded ${type} to ${targetJid}`);

    } catch (error) {
        console.error('[ViewOnce] Error:', error.message || error);
        if (NOTIFY_USER) {
            try {
                await sock.sendMessage(chatId, { text: '❌ Failed to process view-once media.' }, { quoted: message });
            } catch {}
        }
    }
}

module.exports = viewonceCommand;