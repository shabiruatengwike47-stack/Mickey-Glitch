const settings = require('../settings');
const { addSudo, removeSudo, getSudoList } = require('../lib/index');
const isOwnerOrSudo = require('../lib/isOwner');

/**
 * Extract JID from message (mention or phone number)
 */
function extractJidFromMessage(message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    
    // Try to get mentioned JID first
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length > 0) {
        return mentioned[0];
    }

    // Extract phone number from text (7-15 digits)
    const phoneMatch = text.match(/\b(\d{7,15})\b/);
    if (phoneMatch) {
        const number = phoneMatch[1];
        // Ensure it's a valid phone number
        return number + '@s.whatsapp.net';
    }

    return null;
}

/**
 * Format JID for display
 */
function formatJidForDisplay(jid) {
    if (!jid) return 'Unknown';
    return jid.split('@')[0];
}

/**
 * Sudo Command Handler
 */
async function sudoCommand(sock, chatId, message) {
    try {
        const senderJid = message.key.participant || message.key.remoteJid;
        const isOwner = message.key.fromMe || await isOwnerOrSudo(senderJid, sock, chatId);

        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = rawText.trim().split(' ').slice(1);
        const subCommand = (args[0] || '').toLowerCase();

        // Show help if no valid command
        if (!subCommand || !['add', 'del', 'remove', 'list'].includes(subCommand)) {
            const helpText = `╔════════════════════════════════════╗
║        🔐 SUDO MANAGEMENT        ║
╚════════════════════════════════════╝

*Commands:*
.sudo add <@user|number> - Add sudo user
.sudo del <@user|number> - Remove sudo user
.sudo list - List all sudo users

*Permissions:*
🔓 Sudo users have owner permissions
📌 Only owner can manage sudos

*Example:*
.sudo add 255615944741
.sudo add @user
.sudo list`;

            await sock.sendMessage(chatId, { text: helpText }, { quoted: message });
            return;
        }

        // LIST command - anyone can view
        if (subCommand === 'list') {
            const sudoList = await getSudoList();
            
            if (!sudoList || sudoList.length === 0) {
                await sock.sendMessage(chatId, { 
                    text: '📋 *No sudo users configured*'
                }, { quoted: message });
                return;
            }

            const sudoText = sudoList
                .map((jid, i) => `${i + 1}. ${formatJidForDisplay(jid)}`)
                .join('\n');

            const listMessage = `╔════════════════════════════╗
║     🔐 SUDO USERS LIST      ║
╚════════════════════════════╝

${sudoText}

*Total:* ${sudoList.length} sudo users`;

            await sock.sendMessage(chatId, { text: listMessage }, { quoted: message });
            return;
        }

        // ADD/DEL commands - only owner/sudo can execute
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ *Only owner can manage sudos!*\n\nUse `.sudo list` to view all sudos.'
            }, { quoted: message });
            return;
        }

        // Extract target JID
        const targetJid = extractJidFromMessage(message);
        if (!targetJid) {
            await sock.sendMessage(chatId, { 
                text: '❌ *Invalid user!* Please mention a user or provide a phone number.\n\n*Example:* .sudo add 255615944741'
            }, { quoted: message });
            return;
        }

        const targetDisplay = formatJidForDisplay(targetJid);
        const ownerJid = settings.ownerNumber + '@s.whatsapp.net';

        // ADD sudo
        if (subCommand === 'add') {
            if (targetJid === ownerJid) {
                await sock.sendMessage(chatId, { 
                    text: '⚠️ *Owner is already a sudo by default!*'
                }, { quoted: message });
                return;
            }

            const added = await addSudo(targetJid);
            if (added) {
                await sock.sendMessage(chatId, { 
                    text: `✅ *Added sudo: ${targetDisplay}*\n\nThis user now has owner permissions.`
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { 
                    text: `⚠️ *${targetDisplay} is already a sudo user!*`
                }, { quoted: message });
            }
            return;
        }

        // DEL/REMOVE sudo
        if (subCommand === 'del' || subCommand === 'remove') {
            if (targetJid === ownerJid) {
                await sock.sendMessage(chatId, { 
                    text: '❌ *Cannot remove owner!* The owner cannot be removed from sudo.'
                }, { quoted: message });
                return;
            }

            const removed = await removeSudo(targetJid);
            if (removed) {
                await sock.sendMessage(chatId, { 
                    text: `✅ *Removed sudo: ${targetDisplay}*\n\nThis user no longer has owner permissions.`
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { 
                    text: `⚠️ *${targetDisplay} is not a sudo user!*`
                }, { quoted: message });
            }
            return;
        }

    } catch (error) {
        console.error('❌ Error in sudo command:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ *Error:* ${error.message}`
        }, { quoted: message });
    }
}

module.exports = sudoCommand;


