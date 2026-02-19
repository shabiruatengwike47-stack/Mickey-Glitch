/**
 * Mickey Command - Bot information
 */

async function mickeyCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            text: `🎭 *Mickey Bot*\n\nA WhatsApp bot with tons of fun commands and utilities.\n\nUse *.help* or *.menu* to see all available commands.`,
            quoted: message
        });
    } catch (error) {
        console.error('Error in mickeyCommand:', error);
        await sock.sendMessage(chatId, {
            text: '❌ An error occurred while processing your command.',
            quoted: message
        }).catch(() => {});
    }
}

module.exports = mickeyCommand;
