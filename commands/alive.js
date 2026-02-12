const moment = require('moment-timezone');
const owners = require('../data/owner.json');

/**
 * Mickey Glitch Alive Command
 * Refactored for stability, performance, and professional Ad-attribution.
 */

// Configuration Constants
const BOT_VERSION = 'v3.1.0';
const DEFAULT_OWNER = '255615944741';
const IMAGE_URL = 'https://water-billimg.onrender.com/1761205727440.png';
const TIMEZONE = 'Africa/Nairobi';

const aliveCommand = async (conn, chatId, message) => {
    try {
        // Data Preparation
        const name = message.pushName || 'User';
        const owner = (Array.isArray(owners) && owners[0]) ? owners[0] : DEFAULT_OWNER;
        const uptime = formatUptime(process.uptime());
        const timestamp = moment.tz(TIMEZONE);

        // Professional Clean Layout (No ornaments/decorations)
        const caption = [
            `*SYSTEM STATUS REPORT*`,
            `\n*Client:* ${name}`,
            `*Status:* Operational`,
            `*Uptime:* ${uptime}`,
            `*Date:* ${timestamp.format('DD MMMM YYYY')}`,
            `*Time:* ${timestamp.format('HH:mm:ss')} (EAT)`,
            `*Owner:* ${owner}`,
            `\n*Mickey Glitch ${BOT_VERSION}*`
        ].join('\n');

        // Professional Ad-Formula Payload
        const messagePayload = {
            text: caption,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                showAdAttribution: true,
                externalAdReply: {
                    title: `MICKEY GLITCH ${BOT_VERSION}`,
                    body: "System Stability: 100%",
                    mediaType: 1,
                    previewType: "PHOTO",
                    thumbnailUrl: IMAGE_URL,
                    sourceUrl: "https://whatsapp.com/channel/0029VaN1N7m7z4kcO3z8m43V",
                    renderLargerThumbnail: true
                }
            }
        };

        return await conn.sendMessage(chatId, messagePayload, { quoted: message });

    } catch (error) {
        console.error(`[ALIVE_ERROR] ${new Date().toISOString()}:`, error.message);
    }
};

/**
 * Formats seconds into a professional duration string
 * @param {number} seconds 
 * @returns {string}
 */
const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    
    return parts.join(' ');
};

module.exports = aliveCommand;
