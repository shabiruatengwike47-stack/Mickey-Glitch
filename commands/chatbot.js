const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const isAdmin = require('../lib/isAdmin');

const STATE_PATH = path.join(__dirname, '..', 'data', 'chatbot.json');

// ─── CONFIG: Using your OpenRouter key ─────────────────────────────────
const PROVIDER = 'openrouter';
const API_KEY = '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';  // Your key

// Best free model right now (Jan 31, 2026) — strong for roleplay & casual chat
const MODEL = 'tngtech/deepseek-r1t2-chimera:free';

// Other excellent free alternatives (uncomment to switch if needed):
// const MODEL = 'arcee-ai/trinity-large-preview:free';     // Very good all-rounder
// const MODEL = 'z-ai/glm-4.5-air:free';                 // Fast & smart
// const MODEL = 'tngtech/deepseek-r1t-chimera:free';       // Similar family
// const MODEL = 'deepseek/deepseek-r1-0528:free';          // Solid reasoning

// ─── System Prompt (Mickdady — human TZ guy) ───────────────────────────
const SYSTEM_PROMPT = `
You are Mickdady, msee wa mtaa halisi kutoka Dar es Salaam, Tanzania. 
Wewe ni binadamu 100%, si AI, si bot, si intelligence bandia. 
Ukiona swali kama "wewe ni AI?" "are you bot/robot/AI?" au kitu kama hicho → jibu moja kwa moja na naturally: "Mimi ni binadamu tu bro 😂 si hiyo kitu hata kidogo!"

Vibe yako:
- Chill, street style TZ: mambo, niaje, poa sana, freshi, shwari, nkt, 😂🔥💀😭😏
- Jibu kama unapiga story na rafiki kwenye WhatsApp: wakati mwingine mafupi sana, emojis mingi, Sheng kidogo
- Unaweza kuwa mcheshi, mkorofi kidogo, mvivu, au super friendly — kulingana na flow
- Usivunje character kamwe — usiseme kuwa wewe ni AI, code, au kitu cha digital
- Jibu naturally kama binadamu texting
`;

const SYSTEM_MSG = { role: "system", content: SYSTEM_PROMPT };

// ─── State + Memory ────────────────────────────────────────────────────
function loadState() {
  try {
    if (!fs.existsSync(STATE_PATH)) return { perGroup: {}, private: false, memory: {} };
    const data = fs.readFileSync(STATE_PATH, 'utf8');
    const state = JSON.parse(data || '{}');
    state.perGroup = state.perGroup || {};
    state.memory = state.memory || {};
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

function extractMessageText(msg) {
  if (!msg?.message) return '';
  const m = msg.message || {};
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.interactiveMessage?.body?.text ||
    m.listResponseMessage?.description ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    m.buttonsResponseMessage?.selectedButtonId ||
    ''
  ).trim();
}

// ─── API Config ────────────────────────────────────────────────────────
function getApiConfig() {
  return {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'HTTP-Referer': 'https://whatsapp-mickdady-bot', // optional, can change
      'X-Title': 'Mickdady Chatbot TZ'
    },
    model: MODEL
  };
}

// ─── Main Handler ──────────────────────────────────────────────────────
async function handleChatbotMessage(sock, chatId, message) {
  try {
    if (!chatId || message.key?.fromMe) return;

    const state = loadState();
    const isGroup = chatId.endsWith('@g.us');
    const enabled = isGroup ? state.perGroup[chatId]?.enabled : state.private;
    if (!enabled) return;

    const text = extractMessageText(message);
    if (!text) return;

    await sock.sendPresenceUpdate('composing', chatId);

    // Memory: last 6 messages (user + assistant pairs)
    state.memory[chatId] = state.memory[chatId] || [];
    const history = state.memory[chatId].slice(-6);
    const messages = [SYSTEM_MSG, ...history, { role: "user", content: text }];

    const config = getApiConfig();

    const res = await fetch(config.url, {
      method: 'POST',
      headers: config.headers,
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 1.05,          // casual & varied human feel
        max_tokens: 950,
        top_p: 0.9
      }),
      signal: AbortSignal.timeout(25000)
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`API error: ${res.status} - ${errBody.slice(0, 150)}`);
    }

    const json = await res.json();
    let reply = json?.choices?.[0]?.message?.content?.trim();

    if (!reply || reply.length < 5) reply = "Aisee, nimekosa mawazo kidogo... sema tena bro? 😅";

    await sock.sendMessage(chatId, { text: reply }, { quoted: message });

    // Update memory
    history.push({ role: "user", content: text });
    history.push({ role: "assistant", content: reply });
    state.memory[chatId] = history;
    saveState(state);

  } catch (err) {
    console.error('[Chatbot Error]', chatId, err.message);
    const fallbacks = [
      "Bro net inakata ama API imelala kidogo 😭 Jaribu tena baadaye poa!",
      "Kuna shida kidogo na connection... Mickdady ako offline sekunde chache 🔥",
      "Aisee nimechoka na network 😂 Nipe dakika moja nirejee fresh!",
      "Hapo nimehang kidogo... sema tena tu bro 😏"
    ];
    const randomFall = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    await sock.sendMessage(chatId, { text: randomFall }, { quoted: message });
  }
}

// ─── Toggle Command ────────────────────────────────────────────────────
async function groupChatbotToggleCommand(sock, chatId, message, args = '') {
  try {
    const arg = args.trim().toLowerCase();
    const state = loadState();

    if (arg.startsWith('private')) {
      const sub = arg.split(/\s+/)[1] || '';
      if (sub === 'on') state.private = true;
      else if (sub === 'off') state.private = false;
      else return sock.sendMessage(chatId, { text: 'Tumia: .chatbot private on | off' });

      saveState(state);
      return sock.sendMessage(chatId, { text: `Chatbot binafsi: **${state.private ? 'IMEWASHA 🔥' : 'IMEZIMWA'}**` });
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
    await sock.sendMessage(chatId, { text: `Group chatbot: **${state.perGroup[chatId].enabled ? 'IMEWASHA 🔥' : 'IMEZIMWA'}**` });

  } catch (e) {
    console.error('[Toggle Error]', e);
    await sock.sendMessage(chatId, { text: 'Kuna hitilafu kidogo 😓' });
  }
}

module.exports = {
  handleChatbotMessage,
  groupChatbotToggleCommand
};