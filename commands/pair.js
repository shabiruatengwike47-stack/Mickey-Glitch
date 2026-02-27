const { sleep } = require('../lib/myfunc');

async function pairCommand(sock, chatId, message, q) {
    try {
        if (!q) {
            return await sock.sendMessage(chatId, {
                text: "╭━━━━━━━━━━━━━━━━━━┈⊷\n┃●│➣ *📱 PAIRING COMMAND*\n╰━━━━━━━━━━━━━━━━━━┈⊷\n\n*Usage:* `.pair <number>`\n*Example:* `.pair 2347030626048`\n*Multiple:* `.pair 26370xxxx, 26381xxxx`\n\n*Note:* Enter numbers without + or spaces",
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363418027651738@newsletter',
                        newsletterName: 'TKT-CYBER-XMD',
                        serverMessageId: -1
                    }
                }
            });
        }

        const numbers = q.split(',')
            .map((v) => v.trim().replace(/[^0-9]/g, ''))
            .filter((v) => v.length >= 10 && v.length <= 15);

        if (numbers.length === 0) {
            return await sock.sendMessage(chatId, {
                text: "╭━━━━━━━━━━━━━━━━━━┈⊷\n┃✮│➣ *❌ INVALID FORMAT*\n╰━━━━━━━━━━━━━━━━━━┈⊷\n\nPlease use correct format:\n`.pair 2347030626048`\n`.pair 26370xxxx, 26381xxxx`",
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363418027651738@newsletter',
                        newsletterName: 'TKT-CYBER-XMD',
                        serverMessageId: -1
                    }
                }
            });
        }

        await sock.sendMessage(chatId, {
            text: "╭━━━━━━━━━━━━━━━━━━┈⊷\n┃✮│➣ *⏳ PROCESSING*\n╰━━━━━━━━━━━━━━━━━━┈⊷\n\nGenerating pairing codes...",
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363418027651738@newsletter',
                    newsletterName: 'TKT-CYBER-XMD',
                    serverMessageId: -1
                }
            }
        });

        let results = [];
        
        for (const number of numbers) {
            try {
                // Use index.js pairing formula with country code handling
                let phone = number;
                if (!phone.startsWith('255')) phone = '255' + phone;

                console.log(`⏳ Processing: +${phone}`);
                await sleep(2000);

                const code = await sock.requestPairingCode(phone);
                const formattedCode = code.match(/.{1,4}/g)?.join(' - ') || code;
                results.push(`✅ ${number}: ${formattedCode}`);
                
                await sock.sendMessage(chatId, {
                    text: `╭━━━━━━━━━━━━━━━━━━┈⊷\n┃✮│➣ *✅ PAIRING CODE*\n╰━━━━━━━━━━━━━━━━━━┈⊷\n\n📱 *Number:* ${number}\n🔑 *Code:* \`${formattedCode}\`\n\n*How to use:*\n1. Open WhatsApp → Linked Devices\n2. Tap "Link a Device"\n3. Enter code: *${formattedCode}*\n⏰ Code expires in 30 seconds!`,
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363418027651738@newsletter',
                            newsletterName: 'TKT-CYBER-XMD',
                            serverMessageId: -1
                        }
                    }
                });
            } catch (pairError) {
                console.error('Pairing Error:', pairError);
                results.push(`❌ ${number}: Failed to generate pairing code - ${pairError.message}`);
            }
        }

        // Send summary
        if (results.length > 0) {
            const summary = `╭━━━━━━━━━━━━━━━━━━┈⊷\n┃✮│➣ *📊 PAIRING SUMMARY*\n╰━━━━━━━━━━━━━━━━━━┈⊷\n\n${results.join('\n')}\n\n*✅ Process completed!*`;
            await sock.sendMessage(chatId, {
                text: summary,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363418027651738@newsletter',
                        newsletterName: 'TKT-CYBER-TEC',
                        serverMessageId: -1
                    }
                }
            });
        }

    } catch (error) {
        console.error(error);
        await sock.sendMessage(chatId, {
            text: "╭━━━━━━━━━━━━━━━━━━┈⊷\n┃✮│➣ *❌ SYSTEM ERROR*\n╰━━━━━━━━━━━━━━━━━━┈⊷\n\nAn error occurred. Please try again later.",
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363418027651738@newsletter',
                    newsletterName: 'TKT_TECH',
                    serverMessageId: -1
                }
            }
        });
    }
}

module.exports = pairCommand;