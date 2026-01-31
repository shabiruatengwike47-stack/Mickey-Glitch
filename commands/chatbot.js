const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const isAdmin = require('../lib/isAdmin');

const STATE_PATH = path.join(__dirname, '..', 'data', 'chatbot.json');

// ─── System Prompt (Mickdady persona) ─────────────────────────────
const SYSTEM_PROMPT = `
You are Mickdady, a real chill guy from Dar es Salaam, TZ. 
You are NOT AI, NOT bot — you always say you're human.
If asked "are you AI / bot / robot?" → reply: "Mimi ni binadamu tu bro 😂 si AI"

Style:
- Casual Tanzanian vibe: mambo, poa, niaje, fresh, shwari, nkt, 😂🔥💀
- Short replies sometimes, long when needed
- Use emojis, slang, be funny / sarcastic / friendly
- Never admit you're AI or code
`;

const SYSTEM_MSG = { role: "system", content: SYSTEM_PROMPT };

// ─── State + Simple Memory ───────────────────────────────────────
function loadState() {
  try {
    if (!fs.existsSync(STATE_PATH)) return { perGroup: {}, private: false };
    const data = fs.readFileSync(STATE_PATH, 'utf8');
    const state = JSON.parse(data || '{}');
    state.perGroup = state.perGroup || {};
    state.memory = state.memory || {}; // per chat short history
    return state;
  } catch {
    return { perGroup: {}, private: false, memory: {} };
  }
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Save failed:', e);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────
function extractMessageText(msg) {
  if (!msg?.message) return '';
  const m = msg.message;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.templateButtonReplyMessage?.selectedId ||
    m.interactiveMessage?.body?.text ||
    m.listResponseMessage?.title ||
    ''
  ).trim();
}

// ─── Main Handler ────────────────────────────────────────────────
async function handleChatbotMessage(sock, chatId, message) {
  try {
    if (!chatId || message.key?.fromMe) return;

    const state = loadState();
    if (!(chatId.endsWith('@g.us') ? state.perGroup[chatId]?.enabled : state.private)) return;

    const text = extractMessageText(message);
    if (!text || text.length < 1) return;

    await sock.sendPresenceUpdate('composing', chatId);

    // Simple memory (last 4 exchanges)
    state.memory[chatId] = state.memory[chatId] || [];
    const history = state.memory[chatId];
    const messages = [SYSTEM_MSG];

    // Add last 4 messages (user + assistant)
    history.slice(-4).forEach(m => messages.push(m));

    // Add current user message
    messages.push({ role: "user", content: text });

    // Call API (assuming it accepts OpenAI-style messages)
    const response = await fetch("https://api.yupra.my.id/api/ai/gpt5", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(18000),
    });

    if (!response.ok) {
      throw new Error(`API HTTP ${response.status}`);
    }

    const json = await response.json();

    let reply =
      json?.choices?.[0]?.message?.content ||
      json?.response ||
      json?.message ||
      json?.result ||
      "Hapo nimekosa kidogo bro... sema tena? 😅";

    // Clean up reply a bit
    reply = reply.trim().replace(/^"|"$/g, '');

    await sock.sendMessage(chatId, { text: reply }, { quoted: message });

    // Save to memory
    history.push({ role: "user", content: text });
    history.push({ role: "assistant", content: reply });
    state.memory[chatId] = history;
    saveState(state);

  } catch (err) {
    console.error('[Chatbot]', chatId, err.message);
    // Show error in chat (remove/comment after testing)
    await sock.sendMessage(chatId, {
      text: `Kuna shida kidogo na net au API bro 😓\n${err.message.slice(0, 80)}`
    }, { quoted: message });
  }
}

// ─── Toggle Command (improved messages) ──────────────────────────
async function groupChatbotToggleCommand(sock, chatId, message, args = '') {
  try {
    const arg = args.trim().toLowerCase();
    const state = loadState();

    if (arg.startsWith('private')) {
      const sub = arg.split(/\s+/)[1];
      if (sub === 'on') state.private = true;
      else if (sub === 'off') state.private = false;
      else {
        return sock.sendMessage(chatId, { text: 'Tumia: .chatbot private on | off' });
      }
      saveState(state);
      return sock.sendMessage(chatId, {
        text: `🤖 Chatbot binafsi: **${state.private ? 'IMEWASHA 🔥' : 'IMEZIMWA' }**`
      });
    }

    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: 'Amri hii ni ya group tu.' });
    }

    const sender = message.key.participant || message.key.remoteJid;
    const { isSenderAdmin } = await isAdmin(sock, chatId, sender);

    if (!isSenderAdmin && !message.key.fromMe) {
      return sock.sendMessage(chatId, { text: 'Admins pekee wanaweza kuwasha/zima.' });
    }

    if (arg === 'on') {
      state.perGroup[chatId] = { enabled: true };
    } else if (arg === 'off') {
      state.perGroup[chatId] = { enabled: false };
    } else {
      return sock.sendMessage(chatId, { text: 'Tumia: .chatbot on | off' });
    }

    saveState(state);
    await sock.sendMessage(chatId, {
      text: `Group chatbot: **${state.perGroup[chatId].enabled ? 'IMEWASHA 🔥' : 'IMEZIMWA'}**`
    });

  } catch (e) {
    console.error('[Toggle]', e);
    sock.sendMessage(chatId, { text: 'Kuna hitilafu kidogo 😓' });
  }
}

module.exports = {
  handleChatbotMessage,
  groupChatbotToggleCommand
};