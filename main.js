// 🧹 Fix for ENOSPC / temp overflow
const fs = require('fs');
const path = require('path');

const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

setInterval(() => {
    fs.readdir(customTemp, (err, files) => {
        if (err) return;
        for (const file of files) {
            const filePath = path.join(customTemp, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && Date.now() - stats.mtimeMs > 3 * 60 * 60 * 1000) {
                    fs.unlink(filePath, () => { });
                }
            });
        }
    });
}, 3 * 60 * 60 * 1000);

const settings = require('./settings');
require('./config.js');
const { isBanned } = require('./lib/isBanned');
const { isSudo } = require('./lib/index');
const isOwnerOrSudo = require('./lib/isOwner');
const isAdmin = require('./lib/isAdmin');
const chalk = require('chalk');

// Command Imports
const helpCommand = require('./commands/help');
const pingCommand = require('./commands/ping');
const aliveCommand = require('./commands/alive');
const ownerCommand = require('./commands/owner');
const { autoStatusCommand, handleStatusUpdate } = require('./commands/autostatus');
const { handleAutoread } = require('./commands/autoread');
const { handleAutotypingForMessage, showTypingAfterCommand } = require('./commands/autotyping');
const { storeMessage, handleMessageRevocation } = require('./commands/antidelete');
const { incrementMessageCount } = require('./commands/topmembers');
const { handleBadwordDetection } = require('./lib/antibadword');
const { Antilink } = require('./lib/antilink');
const { handleChatbotResponse } = require('./commands/chatbot');
const { addCommandReaction } = require('./lib/reactions');

// --- Global settings ---
global.packname = settings.packname;
global.author = settings.author;

const channelInfo = {
    contextInfo: {
        isForwarded: true,
        forwardingScore: 999,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363398106360290@newsletter',
            newsletterName: '🅼🅸🅲🅺🅴𝚈 🚀',
            serverMessageId: 143
        }
    }
};

/**
 * MAIN MESSAGE HANDLER
 */
async function handleMessages(sock, messageUpdate) {
    try {
        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;
        const message = messages[0];
        if (!message?.message) return;

        const chatId = message.key.remoteJid;
        const senderId = message.key.participant || message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const isOwnerOrSudoCheck = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);

        // Auto-read & Store for Anti-delete
        await handleAutoread(sock, message);
        storeMessage(sock, message);

        if (message.message?.protocolMessage?.type === 0) {
            return await handleMessageRevocation(sock, message);
        }

        const userMessage = (
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption || ""
        ).toLowerCase().trim();

        // 🛡️ Moderation: Badwords & Antilink
        if (isGroup) {
            await handleBadwordDetection(sock, chatId, message, userMessage, senderId);
            await Antilink(message, sock);
        }

        if (!message.key.fromMe) incrementMessageCount(chatId, senderId);

        // 🤖 Chatbot Response
        if (!userMessage.startsWith('.')) {
            await handleAutotypingForMessage(sock, chatId, userMessage);
            if (isGroup) {
                await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
            }
            return;
        }

        // ⚙️ Command Switch
        const command = userMessage.split(' ')[0];
        let commandExecuted = true;

        switch (command) {
            case '.ping':
                await pingCommand(sock, chatId, message);
                break;
            case '.alive':
                await aliveCommand(sock, chatId, message);
                break;
            case '.menu':
            case '.help':
                await helpCommand(sock, chatId, message, global.channelLink);
                break;
            case '.owner':
                await ownerCommand(sock, chatId);
                break;
            case '.autostatus':
                if (!isOwnerOrSudoCheck) return;
                const args = userMessage.split(' ').slice(1);
                await autoStatusCommand(sock, chatId, message, args);
                break;
            default:
                commandExecuted = false;
                break;
        }

        if (commandExecuted) {
            await addCommandReaction(sock, message);
            await showTypingAfterCommand(sock, chatId);
        }

    } catch (error) {
        console.error(chalk.red('❌ Error in message handler:'), error.message);
    }
}

/**
 * EXPORTS
 */
module.exports = {
    handleMessages,
    handleStatusUpdate, // Hii sasa itatambuliwa na index.js
    handleGroupParticipantUpdate: async (sock, update) => {
        // Hapa unaweza kuweka logic ya promote/demote/welcome
    }
};
