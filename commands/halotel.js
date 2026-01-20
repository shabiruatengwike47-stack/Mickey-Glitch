const { sendButtons, getBuffer } = require('../lib/myfunc');
const settings = require('../settings');
const axios = require('axios');

// ────────────────────────────────────────────────
const PRICE_PER_GB = 1000; 
const MIN_GB = 10;
const SELLER_NUMBER = '255615944741';
const SELLER_JID = `${SELLER_NUMBER}@s.whatsapp.net`;
const SELLER_NAME = 'MICKDADI HAMZA SALIM';

const AD_BANNER_2 = 'https://files.catbox.moe/ljabyq.png';
const CONFIRMATION_AUDIO = 'https://files.catbox.moe/t80fnj.mp3';

// ────────────────────────────────────────────────

let orderCounter = 1000;

function formatNumber(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function generateOrderRef() {
    return `HTL-${Math.floor(1000 + Math.random() * 9000)}`;
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
            const menu = `🚀 *HALOTEL DATA SHOP*\n\n*Rate:* TSh ${formatNumber(PRICE_PER_GB)} / GB\n*Min:* ${MIN_GB} GB\n\n*Format:* .halotel <GB> <Number>\n*Example:* .halotel 20 255612130873`;
            return await sock.sendMessage(chatId, { text: menu }, { quoted: message });
        }

        // --- IMPROVED CALCULATION LOGIC ---
        // Find the first number in args that is >= MIN_GB and treat as GB
        let gbInput = args.find(a => !isNaN(parseFloat(a)) && parseFloat(a) >= MIN_GB);
        let gbAmount = gbInput ? parseFloat(gbInput) : null;
        
        // Find a phone-like number (9 to 13 digits)
        let phoneNumber = args.find(a => a.replace(/[^0-9]/g, '').length >= 9 && a.replace(/[^0-9]/g, '').length <= 13);

        if (!gbAmount || !phoneNumber) {
            return await sock.sendMessage(chatId, { text: '💡 *Usage:* .halotel <GB> <Number>\nExample: `.halotel 12 255615000000`' });
        }

        // Precise math calculation
        const totalPrice = Math.floor(gbAmount * PRICE_PER_GB);
        const orderRef = generateOrderRef();

        const orderInfo = `✨ *ORDER SUMMARY*\n━━━━━━━━━━━━━━━━━━\n📦 *Bundle:* ${gbAmount} GB\n📱 *Number:* ${phoneNumber}\n💰 *Amount:* TSh ${formatNumber(totalPrice)}\n🆔 *Ref:* ${orderRef}\n━━━━━━━━━━━━━━━━━━\n\n*Payment Details:*\nAccount: ${SELLER_NAME}\nNumber: ${SELLER_NUMBER}\n\n_Kindly pay then click confirm below:_`;

        const buttons = [
            {
                urlButton: {
                    displayText: '💳 Confirm Payment',
                    url: `https://wa.me/${SELLER_NUMBER}?text=Paid+Ref:${orderRef}+${gbAmount}GB+for+${phoneNumber}`
                }
            }
        ];

        let banner = null;
        try { banner = await getBuffer(AD_BANNER_2); } catch (e) {}

        await sendButtons(sock, chatId, orderInfo, 'Mickey Glitch Technology', buttons, message, {
            contextInfo: {
                externalAdReply: {
                    title: `Halotel Payment: TSh ${formatNumber(totalPrice)}`,
                    body: `Order ID: ${orderRef}`,
                    thumbnail: banner,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        });

        // --- FIXED AUDIO PLAYBACK LOGIC ---
        setTimeout(async () => {
            try {
                // Fetching as arraybuffer is the most stable way for Baileys
                const resp = await axios.get(CONFIRMATION_AUDIO, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(resp.data);

                await sock.sendMessage(chatId, {
                    audio: buffer,
                    // 'audio/ogg; codecs=opus' is the universal standard for WhatsApp voice notes
                    mimetype: 'audio/ogg; codecs=opus', 
                    ptt: true // Sends as a blue-microphone voice note
                }, { quoted: message });
            } catch (e) {
                console.log('Audio Error:', e.message);
            }
        }, 1500);

        // Notify Seller
        await sock.sendMessage(SELLER_JID, {
            text: `🔔 *New Order:* ${orderRef}\n📦 ${gbAmount}GB\n📱 ${phoneNumber}\n💰 TSh ${formatNumber(totalPrice)}`
        });

    } catch (error) {
        await sock.sendMessage(chatId, { text: '🔄 Just a moment, let\'s try that again!' });
    }
}

module.exports = halotelCommand;
