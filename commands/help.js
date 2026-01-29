// ──────────────────────────────────────────────────────────────
//  Better display name resolution for TTS & help header
// ──────────────────────────────────────────────────────────────

/**
 * Get the most human-friendly name possible for greetings / display
 * Order of preference:
 * 1. Contact name (from phonebook / saved contact)
 * 2. pushName (WhatsApp display name set by user)
 * 3. Phone number (last resort)
 */
async function getBestDisplayName(sock, message) {
  try {
    let jid = null;

    // Group participant or private chat
    if (message?.key?.participant) {
      jid = message.key.participant;
    } else if (message?.key?.from || message?.key?.remoteJid) {
      jid = message.key.from || message.key.remoteJid;
    }

    if (!jid) return 'friend';

    // ─── Try to get real contact name from store ───
    try {
      const contact = await sock.getContact(jid); // ← most reliable when available
      if (contact?.name || contact?.verifiedName || contact?.notify) {
        return contact.name || contact.verifiedName || contact.notify;
      }
    } catch (e) {
      // sock.getContact may not exist or fail → silent fallback
    }

    // ─── Fallbacks ───
    if (message?.pushName && message.pushName.trim().length > 1) {
      return message.pushName.trim();
    }

    // Last resort: phone number
    const number = jid.split('@')[0];
    return number || 'someone';

  } catch (err) {
    console.error('[getBestDisplayName]', err);
    return 'friend';
  }
}

// ──────────────────────────────────────────────────────────────

/**
 * Generate and send TTS audio greeting with better name
 */
async function sendTTSGreeting(sock, chatId, message) {
  try {
    // ← Improved name resolution
    const displayName = await getBestDisplayName(sock, message);

    const greetingText = `Hello ${displayName}, thanks for trusting my bot. Enjoy using Mickey Glitch!`;

    const fileName = `greeting-${Date.now()}.mp3`;
    const dir = path.join(__dirname, '..', 'assets');
    const filePath = path.join(dir, fileName);

    await fs.promises.mkdir(dir, { recursive: true });

    const gtts = new gTTS(greetingText, 'en');

    await new Promise((resolve, reject) => {
      gtts.save(filePath, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const buffer = await fs.promises.readFile(filePath);

    if (buffer?.length > 0) {
      await sock.sendMessage(chatId, {
        audio: buffer,
        mimetype: 'audio/mpeg',
        ptt: true
      }, { quoted: message });
    }

    // Cleanup
    try { await fs.promises.unlink(filePath); } catch (_) {}

  } catch (err) {
    console.error('[TTS Greeting] Failed:', err);
    // silent fail - don't break help command
  }
}

// ──────────────────────────────────────────────────────────────

async function helpCommand(sock, chatId, message) {
  if (!sock || !chatId) return;

  try {
    // ... (your existing code until display name part)

    // Improved name resolution (used both in header & TTS)
    const displayName = await getBestDisplayName(sock, message);
    const userId = message?.key?.participant?.split('@')[0] ||
                   message?.key?.from?.split('@')[0] ||
                   'Unknown';

    // ... build cmdList ...

    const helpText = buildHelpMessage(cmdList, {
      runtime,
      mode,
      prefix,
      ramUsed: memUsedGB,
      ramTotal: memTotalGB,
      time: timeNow,
      user: userId,
      name: displayName   // ← better name here too
    });

    // ... send help text (your existing code) ...

    // Send voice greeting **after** text
    await sendTTSGreeting(sock, chatId, message);

  } catch (error) {
    console.error('helpCommand Error:', error);
    await sock.sendMessage(chatId, {
      text: `*Error:* \( {error?.message || error}\n\n \){FALLBACK}`
    }, { quoted: message });
  }
}

module.exports = helpCommand;