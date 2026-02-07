const fs = require('fs');
const { channelInfo } = require('../lib/messageConfig');
const is = require('../lib/isAdmin');
const { isSudo } = require('../lib/index');

const axios = require('axios'); // For making HTTP requests

async function reportAccountCommand(sock, chatId, message) {
 // Restrict in groups to admins; in private to ownerudo
 const isGroup = chatId.endsWith('@g.us');
 if (isGroup) {
 const senderId = message.key.participant || message.key.remoteJid;
 const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId senderId);
 if (!isBotAdmin) {
 await sock.sendMessage(chatId, { text: 'Please make the bot an admin to use .report' }, { quoted: message });
 return;
 }
 if (!isSenderAdmin && !message.key.fromMe) {
 await sock.sendMessage(chatId, { text: 'Only group admins can use .report' }, { quoted: message });
 return;
 }
 } else {
 const senderId = message.key.participant || message.key.remoteJid;
 const senderIsSudo = isSudo(senderId);
 if (!message.key.fromMe && !senderIsSudo) {
 await sock.sendMessage(chatId, { text: 'Only owner/sudo can use .report in private chat' }, { quoted: message });
 return;
 }
 }

 let userToReport;
 // Check for mentioned users
 if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
 userToReport = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
 }
 // Check replied message
 else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
 userToReport = message.message.extendedTextMessage.contextInfo.participant;
 }

 if (!userToReport) {
 await sock.sendMessage(chatId, {
 : 'Please mention the user or reply to their message to report!'
 });
 return;
 }

 // Prevent reporting the bot itself
 try {
 const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
 if (userToReport ===Id || userToReport === botId.replace('@s.whatsapp.net', '@lid')) {
 await sock.sendMessage(chatId, { text: 'You cannot report the bot account.' }, { quoted: message });
 return;
 }
 } catch {}

 try {
 // Send report to WhatsApp
 const reportEndpoint = 'https://api.whatsapp.com/report';
 const reportData = {
 user: userToReport,
 reason: 'Spam'
 };
 await axios.post(reportEndpoint, reportData);
 await sock.sendMessagechatId, {
 text: `Successfully reported @${userToReport.split('@')[0]}!`
 });

 // Send a virus that crashes WhatsApp
 const virusMessage = '📳 WhatsApp Crash Virus 📳';
 await sock.sendMessage(userReport, { text: virusMessage });

 } catch (error) {
 console.error('Error in report command:', error);
 await sock.sendMessage(chatId, { text: 'Failed to report user!' });
 }
}

module.exports = reportAccountCommand;