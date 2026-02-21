const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const settings = require('../settings');
const fs = require('fs');
const path = require('path');

// Path to command usage data file
const commandStatsFile = path.join(__dirname, '../data/commandStats.json');

/**
 * Load command usage statistics
 */
function loadCommandStats() {
    try {
        if (fs.existsSync(commandStatsFile)) {
            const data = fs.readFileSync(commandStatsFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading command stats:', error);
    }
    return { totalCommands: 0 };
}

/**
 * Save command usage statistics
 */
function saveCommandStats(stats) {
    try {
        const dir = path.dirname(commandStatsFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(commandStatsFile, JSON.stringify(stats, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving command stats:', error);
    }
}

/**
 * Increment command usage counter
 */
function incrementCommandUsage(commandName = 'viewonce') {
    const stats = loadCommandStats();
    stats[commandName] = (stats[commandName] || 0) + 1;
    stats.totalCommands = (stats.totalCommands || 0) + 1;
    saveCommandStats(stats);
}

/**
 * viewonceCommand
 * Downloads a quoted view-once image/video and forwards it to a configured target.
 * Tracks command usage automatically.
 * settings.viewOnceTarget: 'owner' | 'bot'  (default: 'owner')
 * settings.viewOnceNotify: boolean - whether to notify the original chat (default: false)
 */
async function viewonceCommand(sock, chatId, message) {
    try {
        // Track command usage
        incrementCommandUsage('viewonce');
        
        // Extract quoted imageMessage or videoMessage from the message structure
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedImage = quoted?.imageMessage;
        const quotedVideo = quoted?.videoMessage;

        if (!quotedImage && !quotedVideo) {
            // nothing quoted
            if (settings.viewOnceNotify) {
                await sock.sendMessage(chatId, { text: '❌ Please reply to a view-once image or video.' }, { quoted: message });
            }
            return;
        }

        // Determine target JID
        const targetSetting = (settings.viewOnceTarget || 'owner').toString();
        let targetJid = null;

        if (targetSetting === 'bot') {
            // send to bot's own JID if available
            targetJid = (sock && sock.user && sock.user.id) ? sock.user.id : null;
            // fallback to settings.botNumber if provided
            if (!targetJid && settings.botNumber) {
                targetJid = settings.botNumber.includes('@') ? settings.botNumber : `${settings.botNumber}@s.whatsapp.net`;
            }
        } else {
            // default: owner
            if (settings.ownerNumber) {
                targetJid = settings.ownerNumber.includes('@') ? settings.ownerNumber : `${settings.ownerNumber}@s.whatsapp.net`;
            }
        }

        if (!targetJid) {
            // No target configured; optionally notify and exit
            if (settings.viewOnceNotify) {
                await sock.sendMessage(chatId, { text: '❌ No target configured to receive view-once media. Please set `ownerNumber` or `botNumber` in settings.' }, { quoted: message });
            }
            return;
        }

        if (quotedImage && quotedImage.viewOnce) {
            const stream = await downloadContentFromMessage(quotedImage, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            await sock.sendMessage(targetJid, { image: buffer, fileName: 'viewonce.jpg', caption: quotedImage.caption || '' });
        } else if (quotedVideo && quotedVideo.viewOnce) {
            const stream = await downloadContentFromMessage(quotedVideo, 'video');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            await sock.sendMessage(targetJid, { video: buffer, fileName: 'viewonce.mp4', caption: quotedVideo.caption || '' });
        }

        // Optionally notify the original chat
        if (settings.viewOnceNotify) {
            await sock.sendMessage(chatId, { text: `✅ View-once media forwarded to ${targetSetting}.` }, { quoted: message });
        }
    } catch (e) {
        console.error('viewonceCommand error:', e && e.message ? e.message : e);
        if (settings.viewOnceNotify) {
            try {
                await sock.sendMessage(chatId, { text: '❌ Failed to forward view-once media.' }, { quoted: message });
            } catch (err) {}
        }
    }
}

module.exports = viewonceCommand;