const { sleep } = require('../lib/myfunc');

// -- new version inserted below --

// common contextInfo block used for all outgoing messages
const BASE_CONTEXT = {
    forwardingScore: 1,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: '120363418027651738@newsletter',
        newsletterName: 'TKT-CYBER-XMD',
        serverMessageId: -1
    }
};

async function pairCommand(sock, chatId, message, q) {
    try {
        if (!q) return sendUsage(sock, chatId);

        const numbers = parseNumbers(q);
        if (numbers.length === 0) return sendInvalidFormat(sock, chatId);

        await sock.sendMessage(chatId, { text: processingText(), contextInfo: BASE_CONTEXT });

        const results = [];

        for (const raw of numbers) {
            const number = raw;
            try {
                const phone = normalizeNumber(number);
                console.log(`⏳ Processing pairing for +${phone}`);
                await sleep(2000);

                const code = await sock.requestPairingCode(phone);
                const formatted = formatCode(code);

                results.push(`✅ ${number}: ${formatted}`);

                await sock.sendMessage(chatId, {
                    text: pairingMessage(number, formatted),
                    contextInfo: BASE_CONTEXT
                });
            } catch (err) {
                console.error('Pairing Error:', err);
                results.push(`❌ ${number}: ${err.message}`);
            }
        }

        if (results.length) {
            await sock.sendMessage(chatId, {
                text: summaryText(results),
                contextInfo: {
                    ...BASE_CONTEXT,
                    forwardedNewsletterMessageInfo: {
                        ...BASE_CONTEXT.forwardedNewsletterMessageInfo,
                        newsletterName: 'TKT-CYBER-TEC'
                    }
                }
            });
        }
    } catch (error) {
        console.error('pairCommand error:', error);
        await sock.sendMessage(chatId, { text: systemErrorText(), contextInfo: BASE_CONTEXT });
    }
}

// helpers
function parseNumbers(input) {
    return input
        .split(',')
        .map(v => v.trim().replace(/[^0-9]/g, ''))
        .filter(v => v.length >= 10 && v.length <= 15);
}

function normalizeNumber(num) {
    return num.startsWith('255') ? num : '255' + num;
}

function formatCode(code) {
    return code.match(/.{1,4}/g)?.join(' - ') || code;
}

function sendUsage(sock, chatId) {
    const text = `╭━━━━━━━━━━━━━━━━━━┈⊷\n┃●│➣ *📱 PAIRING COMMAND*\n╰━━━━━━━━━━━━━━━━━━┈⊷\n\n*Usage:* \\.pair <number>\n*Example:* \\.pair 2347030626048\n*Multiple:* \\.pair 26370xxxx, 26381xxxx\n\n*Note:* Enter numbers without + or spaces`;
    return sock.sendMessage(chatId, { text, contextInfo: BASE_CONTEXT });
}

function sendInvalidFormat(sock, chatId) {
    const text = `╭━━━━━━━━━━━━━━━━━━┈⊷\n┃✮│➣ *❌ INVALID FORMAT*\n╰━━━━━━━━━━━━━━━━━━┈⊷\n\nPlease use correct format:\n\\.pair 2347030626048\n\\.pair 26370xxxx, 26381xxxx`;
    return sock.sendMessage(chatId, { text, contextInfo: BASE_CONTEXT });
}

function processingText() {
    return `╭━━━━━━━━━━━━━━━━━━┈⊷\n┃✮│➣ *⏳ PROCESSING*\n╰━━━━━━━━━━━━━━━━━━┈⊷\n\nGenerating pairing codes...`;
}

function pairingMessage(number, code) {
    return `╭━━━━━━━━━━━━━━━━━━┈⊷\n┃✮│➣ *✅ PAIRING CODE*\n╰━━━━━━━━━━━━━━━━━━┈⊷\n\n📱 *Number:* ${number}\n🔑 *Code:* \`${code}\`\n\n*How to use:*\n1. Open WhatsApp → Linked Devices\n2. Tap "Link a Device"\n3. Enter code: *${code}*\n⏰ Code expires in 30 seconds!`;
}

function summaryText(results) {
    return `╭━━━━━━━━━━━━━━━━━━┈⊷\n┃✮│➣ *📊 PAIRING SUMMARY*\n╰━━━━━━━━━━━━━━━━━━┈⊷\n\n${results.join('\n')}\n\n*✅ Process completed!*`;
}

function systemErrorText() {
    return `╭━━━━━━━━━━━━━━━━━━┈⊷\n┃✮│➣ *❌ SYSTEM ERROR*\n╰━━━━━━━━━━━━━━━━━━┈⊷\n\nAn error occurred. Please try again later.`;
}

module.exports = pairCommand;