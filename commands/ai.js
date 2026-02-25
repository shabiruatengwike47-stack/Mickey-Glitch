const { callAI } = require('./chatbot');

/**
 * AI Command Handler
 * Usage: .ai <question or message>
 * Example: .ai hello
 */
async function aiCommand(sock, chatId, message) {
  try {
    // Extract text from message
    const textBody = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || '';
    
    const userText = textBody.split(" ").slice(1).join(" ").trim();

    if (!userText) {
      await sock.sendMessage(chatId, { 
        text: '🤖 *AI Chat*\n\nMfano: *.ai hello*\n\nYaani:\n*.ai why is sky blue?*'
      }, { quoted: message });
      return;
    }

    // Show typing
    await sock.sendPresenceUpdate('composing', chatId);

    // Show thinking reaction
    await sock.sendMessage(chatId, { 
      react: { text: '⏳', key: message.key } 
    });

    try {
      // Call AI API (uses primary + fallback from `commands/chatbot.js`)
      const reply = await callAI(userText);

      // Clean reply
      let cleanReply = reply || "Samahani, siwezi kujibu kwa sasa.";

      // Send response
      await sock.sendMessage(chatId, { 
        text: cleanReply 
      }, { quoted: message });

      // Success reaction
      await sock.sendMessage(chatId, { 
        react: { text: '✅', key: message.key } 
      });

    } catch (apiError) {
      console.error('API Error:', apiError.message || apiError);
      
      let errorMsg = '❌ Api error, jaribu tena baada ya dakika.';
      if (apiError?.message?.includes('timeout')) {
        errorMsg = '⏱️ Timeout - jaribu swali rahisi zaidi.';
      }
      
      await sock.sendMessage(chatId, { 
        text: errorMsg 
      }, { quoted: message });
    }

  } catch (error) {
    console.error('AI Command Error:', error.message || error);
    await sock.sendMessage(chatId, { 
      text: '🚨 Hitilafu imetokea, jaribu tena.' 
    }, { quoted: message });
  }
}

module.exports = aiCommand; 