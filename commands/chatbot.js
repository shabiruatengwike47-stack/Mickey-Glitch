const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const isAdmin = require('../lib/isAdmin');

const STATE_PATH = path.join(__dirname, '..', 'data', 'chatbot.json');

// --- State Management ---
function loadState() {
  try {
    if (!fs.existsSync(STATE_PATH)) return { perGroup: {}, private: false };
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const state = JSON.parse(raw || '{}');
    if (!state.perGroup) state.perGroup = {};
    return state;
  } catch (e) {
    return { perGroup: {}, private: false };
  }
}

function saveState(state) {
  try {
    const dataDir = path.dirname(STATE_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save chatbot state:', e);
  }
}

async function isEnabledForChat(state, chatId) {
  if (!state || !chatId) return false;
  if (chatId.endsWith('@g.us')) {
    return !!state.perGroup?.[chatId]?.enabled;
  }
  return !!state.private;
}

function extractMessageText(message) {
  if (!message?.message) return '';
  const msg = message.message;
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.interactiveMessage?.body?.text ||
    ''
  ).trim();
}

// --- Main Chatbot Logic ---
async function handleChatbotMessage(sock, chatId, message) {
  try {
    if (!chatId || message.key?.fromMe) return;

    const state = loadState();
    if (!(await isEnabledForChat(state, chatId))) return;

    const userText = extractMessageText(message);
    if (!userText) return;

    // Show typing status
    await sock.sendPresenceUpdate('composing', chatId);

    // Get AI response
    const apiUrl = `https://api.yupra.my.id/api/ai/gpt5?text=${encodeURIComponent(userText)}`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();

    const replyText = data?.response || data?.message || data?.result || "I couldn't process that.";

    // Send text reply only
    await sock.sendMessage(chatId, { text: replyText }, { quoted: message });

  } catch (err) {
    console.error('[Chatbot Error]:', err.message);
  }
}

// --- Toggle Command ---
async function groupChatbotToggleCommand(sock, chatId, message, args) {
  try {
    const argStr = (args || '').trim().toLowerCase();
    const state = loadState();

    // Handle Private Chatbot Toggle
    if (argStr.startsWith('private')) {
      const sub = argStr.split(/\s+/)[1];
      if (sub === 'on') state.private = true;
      else if (sub === 'off') state.private = false;
      else return sock.sendMessage(chatId, { text: 'Usage: .chatbot private on|off' });

      saveState(state);
      return sock.sendMessage(chatId, { text: `Private Chatbot: *${state.private ? 'ON' : 'OFF'}*` });
    }

    // Handle Group Chatbot Toggle
    if (!chatId.endsWith('@g.us')) return sock.sendMessage(chatId, { text: 'Use this in a group.' });

    const sender = message.key.participant || message.key.remoteJid;
    const adminInfo = await isAdmin(sock, chatId, sender);
    if (!adminInfo.isSenderAdmin && !message.key.fromMe) {
      return sock.sendMessage(chatId, { text: 'Admins only.' });
    }

    if (argStr === 'on') state.perGroup[chatId] = { enabled: true };
    else if (argStr === 'off') state.perGroup[chatId] = { enabled: false };
    else return sock.sendMessage(chatId, { text: 'Usage: .chatbot on|off' });

    saveState(state);
    return sock.sendMessage(chatId, { text: `Group Chatbot: *${state.perGroup[chatId].enabled ? 'ON' : 'OFF'}*` });

  } catch (e) {
    console.error('[Toggle Error]:', e);
    sock.sendMessage(chatId, { text: 'Command failed.' });
  }
}

// Ensure these are exported correctly
module.exports = {
  handleChatbotMessage,
  groupChatbotToggleCommand
};
