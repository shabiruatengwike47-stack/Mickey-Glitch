const { sendButtons, getBuffer } = require('../lib/myfunc');
const settings = require('../settings');
const axios = require('axios');

// ────────────────────────────────────────────────
const PRICE_PER_GB = 1000; // Fixed Cost per 1GB
const MIN_GB = 10;
const SELLER_NUMBER = '255615944741';
const SELLER_JID = `${SELLER_NUMBER}@s.whatsapp.net`;
const SELLER_NAME = 'MICKDADI HAMZA SALIM';

const AD_BANNER_2 = 'https://files.catbox.moe/ljabyq.png';
const CONFIRMATION_AUDIO = 'https://files.catbox.moe/t80fnj.mp3';

// ────────────────────────────────────────────────

function formatNumber(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

async function halotelCommand(sock, chatId, message, userMessage = '') {
    try {
        if (chatId.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, {
                text: '👋 *Hello!* Please message me privately to buy bundles securely.'
            }, { quoted: message });
        }

        const text = (userMessage || message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
        const args = text.split(/\s+/).slice(1);

        if (args.length === 0) {
            const menu = `🚀 *HALOTEL DATA SHOP*

*Rate:* TSh ${formatNumber(PRICE_PER_GB)} per 1GB
*Minimum:* ${MIN_GB} GB

*Format:* .halotel <GB> <Number>
*Example:* .halotel 20 255612130873`;

            return await sock.sendMessage(chatId, { text: menu }, { quoted: message });
        }

        // --- FIXED CALCULATION LOGIC ---
        // Clean numbers: remove any text or '+' from input
        let cleanArgs = args.map(a => a.replace(/[^0-9.]/g, ''));
        
        // Find GB (The first number that is >= MIN_GB)
        let gbAmount = parseFloat(cleanArgs.find(a => parseFloat(a) >= MIN_GB));
        
        // Find Phone (The number that looks like a phone number)
        let phoneNumber = cleanArgs.find(a => a.length >= 9 && a.length <= 13);

        if (!gbAmount || isNaN(gbAmount)) {
            return await sock.sendMessage(chatId, { text: `❌ Kindly specify an amount of *at least ${MIN_GB} GB*.` });
        }
        if (!phoneNumber) {
            return await sock.sendMessage(chatId, { text: `❌ Please provide a valid *recipient phone number*.` });
        }

        // Calculate Total Cost
        const totalCost = gbAmount * PRICE_PER_GB;
        const orderRef = `HTL-${Math.floor(1000 + Math.random() * 9000)}`;

        // --- CLEANER DISPLAY ---
        const orderInfo = `✨ *ORDER CONFIRMED*

📦 *Bundle:* ${gbAmount} GB
💰 *Rate:* TSh ${formatNumber(PRICE_PER_GB)} / 1GB
💵 *Total Cost:* TSh ${formatNumber(totalCost)}
📱 *Recipient:* ${phoneNumber}
🆔 *Ref:* ${orderRef}

━━━━━━━━━━━━━━━━━━
*Payment to:*
Name: ${SELLER_NAME}
Number: ${SELLER_NUMBER}

_Pay then click confirm below:_`;

        const buttons = [
            {
                urlButton: {
                    displayText: '💳 Confirm Payment',
                    url: `https://wa.me/${SELLER_NUMBER}?text=Paid+${orderRef}+for+${gbAmount}GB`
                }
            }
        ];

        let banner = null;
        try { banner = await getBuffer(AD_BANNER_2); } catch (e) {}

        await sendButtons(sock, chatId, orderInfo, 'Fast & Secure Delivery', buttons, message, {
            contextInfo: {
                externalAdReply: {
                    title: `Total: TSh ${formatNumber(totalCost)}`,
                    body: `Buying ${gbAmount} GB for ${phoneNumber}`,
                    thumbnail: banner,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        });

        // --- FIXED AUDIO PLAYBACK ---
        setTimeout(async () => {
            try {
                const response = await axios.get(CONFIRMATION_AUDIO, { responseType: 'arraybuffer' });
                await sock.sendMessage(chatId, {
                    audio: Buffer.from(response.data),
                    mimetype: 'audio/ogg; codecs=opus', // Native WhatsApp Format
                    ptt: true 
                }, { quoted: message });
            } catch (e) {}
        }, 1500);

        // Notify Seller
        await sock.sendMessage(SELLER_JID, {
            text: `🔔 *New Order:* ${orderRef}\n📦 ${gbAmount}GB @ TSh ${PRICE_PER_GB}\n💰 Total: TSh ${formatNumber(totalCost)}\n📱 To: ${phoneNumber}`
        });

    } catch (error) {
        await sock.sendMessage(chatId, { text: '🔄 Something went wrong. Let\'s try that again!' });
    }
}

module.exports = halotelCommand;
