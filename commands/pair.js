const { sleep } = require('../lib/myfunc');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

async function pairCommand(sock, chatId, message, q) {
    try {
        console.log(chalk.blue(`[PAIR] Command received with query: ${q}`));

        if (!q) {
            return await sock.sendMessage(chatId, {
                text: "*🔐 Internal Pairing System*\n\n📝 *Usage:*\n.pair <phone_number>\n\n*Example:*\n.pair 6281376552730\n\n*Features:*\n✅ Uses internal WhatsApp pairing\n✅ Sends pairing code via message\n✅ Auto-sends credentials after pairing\n✅ No external API required\n\n⚠️ *Note:* Target number must be registered on WhatsApp"
            });
        }

        const numbers = q.split(',')
            .map((v) => v.replace(/[^0-9]/g, ''))
            .filter((v) => v.length > 5 && v.length < 20);

        if (numbers.length === 0) {
            return await sock.sendMessage(chatId, {
                text: "❌ Invalid number format! Please use correct format.\nExample: .pair 6281376552730"
            });
        }

        for (const number of numbers) {
            console.log(chalk.blue(`[PAIR] Processing number: ${number}`));

            const whatsappID = number + '@s.whatsapp.net';
            
            // Check if number exists on WhatsApp
            try {
                console.log(chalk.blue(`[PAIR] Checking if ${number} exists on WhatsApp...`));
                const result = await sock.onWhatsApp(whatsappID);
                
                if (!result || !result[0]?.exists) {
                    console.log(chalk.red(`[PAIR] Number ${number} not found on WhatsApp`));
                    return await sock.sendMessage(chatId, {
                        text: `❌ Number ${number} is not registered on WhatsApp!`
                    });
                }
                console.log(chalk.green(`[PAIR] Number ${number} exists on WhatsApp`));
            } catch (checkErr) {
                console.error(chalk.red(`[PAIR] Error checking WhatsApp: ${checkErr.message}`));
            }

            try {
                await sock.sendMessage(chatId, {
                    text: `⏳ Generating pairing code for ${number}...\n\n⏱️ Please wait...`
                });

                console.log(chalk.blue(`[PAIR] Checking if requestPairingCode method exists...`));
                
                // Check if the method exists
                if (typeof sock.requestPairingCode !== 'function') {
                    console.log(chalk.red(`[PAIR] requestPairingCode method not found`));
                    console.log(chalk.yellow(`[PAIR] Available methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(sock)).filter(m => typeof sock[m] === 'function').join(', ')}`));
                    
                    return await sock.sendMessage(chatId, {
                        text: '❌ Pairing method not available on this bot version.\n\nPlease use: node index.js --pairing-code'
                    });
                }

                console.log(chalk.blue(`[PAIR] Requesting pairing code for ${number}...`));
                
                // Request pairing code
                let pairingCode = await sock.requestPairingCode(number);
                
                if (!pairingCode) {
                    console.log(chalk.red(`[PAIR] No pairing code returned`));
                    throw new Error('Failed to generate pairing code - no response from server');
                }

                console.log(chalk.green(`[PAIR] Pairing code generated: ${pairingCode}`));

                // Format pairing code
                const formattedCode = pairingCode?.match(/.{1,4}/g)?.join("-") || pairingCode;
                console.log(chalk.green(`[PAIR] Formatted code: ${formattedCode}`));

                // Send pairing code to target number
                const pairingMessage = `🔐 *Mickey Glitch Bot - Pairing Code*\n\n*Your Pairing Code:*\n${formattedCode}\n\n✅ *Setup Instructions:*\n1. Open WhatsApp on your device\n2. Go to Settings → Linked Devices\n3. Tap "Link a Device"\n4. Choose "Link with Phone Number"\n5. Enter this code when prompted\n\n⏰ *Code Expires In:* ~5 minutes\n⚠️ *Keep This Code Private!*\n\n_After successful pairing, your credentials will be automatically sent._`;

                console.log(chalk.blue(`[PAIR] Sending pairing code to ${number}...`));
                await sleep(1000);
                
                await sock.sendMessage(whatsappID, {
                    text: pairingMessage
                });

                console.log(chalk.green(`[PAIR] Pairing code message sent to ${number}`));

                // Notify user
                await sock.sendMessage(chatId, {
                    text: `✅ *Pairing code sent to ${number}*\n\n🔐 Code: ${formattedCode}\n\n⏳ Waiting for device to pair...\n\nOnce paired, credentials will be auto-sent.`
                });

                // Setup credential listener
                console.log(chalk.blue(`[PAIR] Setting up credential update listener...`));
                
                let credentialListenerAdded = false;
                const handleCredUpdate = async () => {
                    if (credentialListenerAdded) return; // Prevent duplicate executions
                    credentialListenerAdded = true;
                    
                    console.log(chalk.green(`[PAIR] Credential update detected!`));
                    
                    try {
                        await sleep(2000);
                        
                        // Send credentials file
                        const credsPath = path.join(__dirname, '../session/creds.json');
                        console.log(chalk.blue(`[PAIR] Looking for credentials at: ${credsPath}`));
                        
                        if (fs.existsSync(credsPath)) {
                            console.log(chalk.green(`[PAIR] Credentials file found!`));
                            const credsBuffer = fs.readFileSync(credsPath);
                            
                            console.log(chalk.blue(`[PAIR] Sending credentials to ${number}...`));
                            await sock.sendMessage(whatsappID, {
                                document: credsBuffer,
                                fileName: 'creds.json',
                                mimetype: 'application/json',
                                caption: '✅ *Your Session Credentials*\n\n🔐 This is your authentication file. Keep it safe!\n\n⚠️ *Important:*\n• Never share this file\n• Store securely\n• Do not delete from bot'
                            });

                            console.log(chalk.green(`[PAIR] Credentials sent to ${number}`));

                            await sock.sendMessage(chatId, {
                                text: `✅ *Pairing Complete!*\n\n🎉 ${number} successfully paired!\n✅ Credentials sent to the paired number.`
                            });
                        } else {
                            console.log(chalk.yellow(`[PAIR] Credentials file not found at ${credsPath}`));
                            console.log(chalk.yellow(`[PAIR] Available files in session:`));
                            try {
                                const sessionFiles = fs.readdirSync(path.join(__dirname, '../session'));
                                console.log(chalk.yellow(sessionFiles.join(', ')));
                            } catch (e) {
                                console.log(chalk.yellow(`Could not list session files`));
                            }
                        }
                    } catch (err) {
                        console.error(chalk.red(`[PAIR] Error sending credentials: ${err.message}`));
                    } finally {
                        // Remove listener
                        if (sock.ev && typeof sock.ev.removeListener === 'function') {
                            sock.ev.removeListener('creds.update', handleCredUpdate);
                        }
                    }
                };

                sock.ev.on('creds.update', handleCredUpdate);

                // Timeout after 5 minutes
                const timeoutId = setTimeout(() => {
                    console.log(chalk.yellow(`[PAIR] Pairing timeout for ${number}`));
                    if (sock.ev && typeof sock.ev.removeListener === 'function') {
                        sock.ev.removeListener('creds.update', handleCredUpdate);
                    }
                }, 5 * 60 * 1000);

            } catch (pairingError) {
                console.error(chalk.red(`[PAIR] Pairing error: ${pairingError.message}`));
                console.error(pairingError);
                
                await sock.sendMessage(chatId, {
                    text: `❌ Pairing failed: ${pairingError?.message || 'Unknown error'}\n\nMake sure the number is valid and registered on WhatsApp.`
                });
            }
        }
    } catch (error) {
        console.error(chalk.red(`[PAIR] Command error: ${error.message}`));
        console.error(error);
        
        await sock.sendMessage(chatId, {
            text: `❌ Error: ${error?.message || error}`
        });
    }
}

module.exports = pairCommand; 