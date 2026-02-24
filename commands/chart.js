const fs = require('fs');
const path = require('path');
const settings = require('../settings');

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
 * Get bot number display
 */
function getBotNumberDisplay(sock) {
    let botNumber = '';
    
    // Try to get from sock user
    if (sock && sock.user && sock.user.id) {
        botNumber = sock.user.id.split('@')[0];
    }
    // Fallback to settings
    else if (settings.botNumber) {
        botNumber = settings.botNumber.replace(/\D/g, '');
    }
    
    return botNumber ? `+${botNumber}` : 'Unknown';
}

/**
 * Generate a visual text-based chart of command usage
 */
function generateCommandChart(stats) {
    const maxBarLength = 20;
    const totalCommands = stats.totalCommands || 0;
    const maxCount = Math.max(...Object.values(stats).filter(v => typeof v === 'number')) || 1;
    
    let chart = '╭━━━〔 *🎯 COMMAND USAGE STATISTICS* 〕━━━┈⊷\n';
    
    // Get sorted commands (excluding totalCommands)
    const sortedCommands = Object.entries(stats)
        .filter(([key]) => key !== 'totalCommands')
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15); // Show top 15 commands
    
    if (sortedCommands.length === 0) {
        chart += '┃ ⚠️ No command data available yet\n';
        chart += '┃ Start using commands to see statistics!\n';
        chart += '╰━━━━━━━━━━━━━━━━━━┈⊷';
        return chart;
    }
    
    // Add header with total stats
    chart += `┃ 📊 *Total Commands Used:* ${totalCommands}\n`;
    chart += `┃ 📈 *Unique Commands:* ${sortedCommands.length}\n`;
    chart += '┃\n';
    
    // Add command bars
    sortedCommands.forEach(([cmd, count], idx) => {
        const barLength = Math.ceil((count / maxCount) * maxBarLength);
        const bar = '█'.repeat(barLength) + '░'.repeat(maxBarLength - barLength);
        const percentage = ((count / totalCommands) * 100).toFixed(1);
        const rank = idx + 1;
        
        // Format command name with padding
        const cmdFormatted = cmd.padEnd(12, ' ');
        chart += `┃ ${rank.toString().padStart(2, ' ')}. \`${cmdFormatted}\` ${bar} ${count.toString().padStart(4, ' ')} (${percentage.toString().padStart(5, ' ')}%)\n`;
    });
    
    chart += '┃\n';
    chart += '╰━━━━━━━━━━━━━━━━━━┈⊷';
    
    return chart;
}

/**
 * Chart Command - Display command usage statistics
 */
async function chartCommand(sock, chatId, message) {
    try {
        const stats = loadCommandStats();
        const botNumber = getBotNumberDisplay(sock);
        
        // Generate chart
        const chart = generateCommandChart(stats);
        
        // Add bot info
        const botInfo = `🤖 *Bot Number:* ${botNumber}\n\n`;
        const finalMessage = botInfo + chart;
        
        // Send chart as an image banner with caption (falls back to text if image fails)
        try {
            await sock.sendMessage(chatId, {
                image: { url: 'https://files.catbox.moe/llc9v7.png' },
                caption: finalMessage
            }, { quoted: message });
        } catch (err) {
            await sock.sendMessage(chatId, { text: finalMessage }, { quoted: message });
        }
        
    } catch (error) {
        console.error('Error in chart command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to load command statistics. Please try again later.'
        }, { quoted: message });
    }
}

module.exports = chartCommand;
