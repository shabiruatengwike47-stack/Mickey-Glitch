const fs = require('fs');
const path = require('fs');
const os = require('os'); // Added for temp files
const { exec } = require('child_process'); // For faster conversion if needed
const fetch = require('node-fetch');
const axios = require('axios');
const isAdmin = require('../lib/isAdmin');

// ... (loadState and saveState stay the same) ...

async function handleChatbotMessage(sock, chatId, message) {
  try {
    if (!chatId || message.key?.fromMe) return;

    const state = loadState();
    if (!(await isEnabledForChat(state, chatId))) return;

    const userText = extractMessageText(message);
    if (!userText) return;

    // 1. Show typing status immediately
    await sock.sendPresenceUpdate('composing', chatId);

    // 2. Fetch AI text response
    const apiUrl = `https://api.yupra.my.id/api/ai/gpt5?text=${encodeURIComponent(userText)}`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    
    const replyText = data?.response || data?.message || data?.result || data?.answer || data?.text || "I'm not sure how to respond to that.";

    // 3. SEND TEXT IMMEDIATELY (Reduces perceived delay)
    const sentMsg = await sock.sendMessage(chatId, { text: replyText }, { quoted: message });

    // 4. GENERATE AUDIO IN BACKGROUND
    // We don't "await" this whole block if we want it to be super fast, 
    // but here we keep it inside the try-catch to handle the voice logic.
    generateAndSendVoice(sock, chatId, replyText, sentMsg);

  } catch (err) {
    console.error('Chatbot general error:', err);
  }
}

/**
 * Separated function to handle voice so it doesn't block the text flow
 */
async function generateAndSendVoice(sock, chatId, text, quotedMsg) {
  const tempMp3 = path.join(os.tmpdir(), `voice_${Date.now()}.mp3`);
  const tempOgg = path.join(os.tmpdir(), `voice_${Date.now()}.opus`);

  try {
    // Limits to prevent API crashes
    if (text.length < 2 || text.length > 1000) return;

    const voiceApiUrl = `https://api.agatz.xyz/api/voiceover?text=${encodeURIComponent(text)}&model=ana`;
    const response = await axios.get(voiceApiUrl, { timeout: 20000 });

    if (!response.data?.data?.oss_url) return;
    const audioUrl = response.data.data.oss_url;

    // Download audio
    const audioRes = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(tempMp3, Buffer.from(audioRes.data));

    // Fast Conversion using FFmpeg Command Line (usually faster than fluent-ffmpeg streams)
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    const { execSync } = require('child_process');
    
    // Convert to WhatsApp-ready OGG/Opus
    execSync(`"${ffmpegPath}" -i "${tempMp3}" -c:a libopus -ac 1 -ar 48000 -b:a 24k -application voip "${tempOgg}" -y`);

    const audioBuffer = fs.readFileSync(tempOgg);

    // Send the audio as a reply to the AI text message
    await sock.sendMessage(chatId, {
      audio: audioBuffer,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true
    }, { quoted: quotedMsg });

  } catch (err) {
    console.error("[Voice Background Error]", err.message);
  } finally {
    // Cleanup files
    if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
    if (fs.existsSync(tempOgg)) fs.unlinkSync(tempOgg);
  }
}
