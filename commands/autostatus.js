const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

// Path to store auto status configuration
const configPath = path.join(__dirname, '../data/autoStatus.json');

// Initialize config file if it doesn't exist
function initConfig() {
    try {
        if (!fs.existsSync(configPath)) {
            const defaultConfig = { 
                enabled: true,
                reactOn: true,
                lastStatusTime: 0,
                statsViewed: 0,
                statsReacted: 0
            };
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        }
    } catch (e) {
        console.error('❌ Error initializing autostatus config:', e.message);
    }
}

// Load config with error handling
function loadConfig() {
    try {
        if (!fs.existsSync(configPath)) {
            initConfig();
        }
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // Ensure defaults are set if missing
        if (config.enabled === undefined) config.enabled = true;
        if (config.reactOn === undefined) config.reactOn = true;
        return config;
    } catch (e) {
        console.error('❌ Error loading autostatus config:', e.message);
        return { enabled: true, reactOn: true, lastStatusTime: 0, statsViewed: 0, statsReacted: 0 };
    }
}

// Save config with error handling
function saveConfig(config) {
    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error('❌ Error saving autostatus config:', e.message);
    }
}

// Initialize on load
initConfig();

/**
 * Main Auto Status Command Handler
 */
async function autoStatusCommand(sock, chatId, msg, args) {
    try {
        const senderId = msg.key.participant || msg.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!msg.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ *Only owner can use this command!*'
            }, { quoted: msg });
            return;
        }

        // Show current status if no args
        if (!args || args.length === 0) {
            const config = loadConfig();
            const viewStatus = config.enabled ? '✅ ON' : '❌ OFF';
            const reactStatus = config.reactOn ? '✅ ON' : '❌ OFF';
            
            const menu = `╔════════════════════════════╗
║   🔄 AUTO STATUS SETTINGS  ║
╚════════════════════════════╝

📱 *View Status:* ${viewStatus}
💚 *React Status:* ${reactStatus}

📊 *Stats:*
👁️ Viewed: ${config.statsViewed}
💬 Reacted: ${config.statsReacted}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Commands:*
.autostatus on - Enable viewing
.autostatus off - Disable viewing
.autostatus react on - Enable reactions
.autostatus react off - Disable reactions
.autostatus reset - Reset stats`;

            await sock.sendMessage(chatId, { text: menu }, { quoted: msg });
            return;
        }

        const command = args[0].toLowerCase();
        const subCommand = args[1]?.toLowerCase();
        let config = loadConfig();

        // Handle main commands
        if (command === 'on') {
            config.enabled = true;
            saveConfig(config);
            await sock.sendMessage(chatId, { 
                text: '✅ *Auto Status View Enabled*\n\nBot will automatically view all incoming statuses.'
            }, { quoted: msg });
        } 
        else if (command === 'off') {
            config.enabled = false;
            saveConfig(config);
            await sock.sendMessage(chatId, { 
                text: '❌ *Auto Status View Disabled*\n\nBot will no longer view statuses.'
            }, { quoted: msg });
        } 
        else if (command === 'react') {
            if (!subCommand || !['on', 'off'].includes(subCommand)) {
                await sock.sendMessage(chatId, { 
                    text: '⚠️ *Usage:* .autostatus react on/off'
                }, { quoted: msg });
                return;
            }

            if (subCommand === 'on') {
                config.reactOn = true;
                saveConfig(config);
                await sock.sendMessage(chatId, { 
                    text: '💚 *Status Reactions Enabled*\n\nBot will react to incoming statuses.'
                }, { quoted: msg });
            } else {
                config.reactOn = false;
                saveConfig(config);
                await sock.sendMessage(chatId, { 
                    text: '🚫 *Status Reactions Disabled*\n\nBot will no longer react to statuses.'
                }, { quoted: msg });
            }
        }
        else if (command === 'reset') {
            config.statsViewed = 0;
            config.statsReacted = 0;
            saveConfig(config);
            await sock.sendMessage(chatId, { 
                text: '🔄 *Statistics reset to 0*'
            }, { quoted: msg });
        }
        else {
            await sock.sendMessage(chatId, { 
                text: '❌ *Unknown command!*\n\nUse .autostatus to see available commands.'
            }, { quoted: msg });
        }

    } catch (error) {
        console.error('❌ Error in autostatus command:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ *Error:* ${error.message}`
        }, { quoted: msg });
    }
}

/**
 * Auto View Statuses
 */
async function autoViewStatus(sock, messageKey) {
    try {
        const config = loadConfig();
        
        if (!config.enabled) {
            return;
        }

        // Rate limiting - max 1 status per 2 seconds
        const now = Date.now();
        if (now - config.lastStatusTime < 2000) {
            return;
        }

        // Mark as status from broadcast
        if (messageKey.remoteJid === 'status@broadcast') {
            try {
                await sock.readMessages([messageKey]);
                config.statsViewed = (config.statsViewed || 0) + 1;
                config.lastStatusTime = now;
                saveConfig(config);
                console.log(`✅ Status viewed (Total: ${config.statsViewed})`);
            } catch (err) {
                if (err.message?.includes('rate-overlimit')) {
                    // Silently skip on rate limit
                    return;
                }
                throw err;
            }
        }
    } catch (error) {
        if (!error.message?.includes('rate-overlimit')) {
            console.error('⚠️ Error in auto view status:', error.message);
        }
    }
}

/**
 * Auto React to Statuses
 */
async function autoReactStatus(sock, messageKey) {
    try {
        const config = loadConfig();
        
        if (!config.reactOn || !config.enabled) {
            return;
        }

        if (messageKey.remoteJid === 'status@broadcast') {
            try {
                // Send heart reaction
                await sock.sendMessage('status@broadcast', {
                    react: {
                        text: '💚',
                        key: messageKey
                    }
                });
                
                config.statsReacted = (config.statsReacted || 0) + 1;
                saveConfig(config);
                console.log(`💚 Status reacted (Total: ${config.statsReacted})`);
            } catch (err) {
                if (err.message?.includes('rate-overlimit')) {
                    // Silently skip on rate limit
                    return;
                }
                throw err;
            }
        }
    } catch (error) {
        if (!error.message?.includes('rate-overlimit')) {
            console.error('⚠️ Error in auto react status:', error.message);
        }
    }
}

/**
 * Handle status messages
 */
async function handleStatusUpdate(sock, statusMessage) {
    try {
        if (!statusMessage.key || statusMessage.key.remoteJid !== 'status@broadcast') {
            return;
        }

        // Auto view
        await autoViewStatus(sock, statusMessage.key);
        
        // Auto react
        await autoReactStatus(sock, statusMessage.key);

    } catch (error) {
        if (!error.message?.includes('rate-overlimit')) {
            console.error('⚠️ Error handling status update:', error.message);
        }
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate,
    autoViewStatus,
    autoReactStatus,
    loadConfig,
    saveConfig
}; 