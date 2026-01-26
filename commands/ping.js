const os = require('os');
const settings = require('../settings.js');

function formatTime(seconds) {
    seconds = Math.floor(seconds);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    if (seconds < 86400) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    }
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    return `${d}d ${h}h`;
}

async function pingCommand(sock, chatId, message) {
    try {
        // Quick pong + latency
        const start = Date.now();
        await sock.sendMessage(chatId, { 
            text: '🏓 Pong!' 
        }, { quoted: message });

        const latency = Date.now() - start;

        // Uptime & memory (compact)
        const botUptime = formatTime(process.uptime());
        const memUsage = process.memoryUsage();
        const usedMB = Math.round(memUsage.rss / 1024 / 1024);
        const totalGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);

        // Version
        const version = settings?.version || 'dev';

        // Final compact message
        const info = 
`🟢 *Mickey Glitch™* is alive!

• Ping     : ${latency} ms
• Uptime   : ${botUptime}
• Memory   : ${usedMB} MB / ${totalGB} GB
• Version  : v${version}
• Time     : ${new Date().toLocaleTimeString('en-US', { timeZone: 'Africa/Dar_es_Salaam' })} EAT`;

        await sock.sendMessage(chatId, { 
            text: info 
        }, { quoted: message });

        // Optional success react
        await sock.sendMessage(chatId, { 
            react: { text: '✅', key: message.key } 
        });

    } catch (err) {
        console.error('[ping] Error:', err.message);
        await sock.sendMessage(chatId, { 
            text: '❌ Ping failed — internal error.' 
        }, { quoted: message });
    }
}

module.exports = pingCommand;