// ════════════════════════════════════════════════════════════════
// 🚀 MICKEY GLITCH BOT - STARTUP SEQUENCE
// ════════════════════════════════════════════════════════════════

console.log('\n' + chalk.bgCyan.black('═'.repeat(60)));
console.log(chalk.bgCyan.black(' 🤖 MICKEY GLITCH BOT - INITIALIZATION STARTING 🤖 '));
console.log(chalk.bgCyan.black('═'.repeat(60)) + '\n');

const startTime = Date.now();

// Helper function for timestamped logs
const log = (icon, status, message) => {
  const time = new Date().toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
  console.log(`${icon} [${chalk.gray(time)}] ${chalk.bold(status)} ${message}`);
};

log('⚙️ ', chalk.cyan('LOADING'), 'Dependencies...');

require('dotenv').config()
log('✓ ', chalk.green('LOADED'), '.env configuration');

require('./settings')
log('✓ ', chalk.green('LOADED'), 'Settings module');

const { Boom } = require('@hapi/boom')
log('✓ ', chalk.green('LOADED'), '@hapi/boom module');

const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
log('✓ ', chalk.green('LOADED'), 'File system utilities');

const path = require('path')
const axios = require('axios')
log('✓ ', chalk.green('LOADED'), 'HTTP & path utilities');
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main')
log('✓ ', chalk.green('LOADED'), 'Message handlers (main.js)');

const { handleAnticall } = require('./commands/anticall')
log('✓ ', chalk.green('LOADED'), 'Anti-call handler');

const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
log('✓ ', chalk.green('LOADED'), 'Media conversion utilities');
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, sleep, reSize } = require('./lib/myfunc')

log('✓ ', chalk.green('LOADED'), 'Custom function library');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
log('✓ ', chalk.green('LOADED'), 'Baileys WhatsApp library');

const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
log('✓ ', chalk.green('LOADED'), 'Cache & logging modules');

console.log('');

// ────────────────[ CONFIG ]───────────────────
log('⚙️ ', chalk.cyan('CONFIG'), 'Loading bot configuration...');

global.botname = "𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™"
global.themeemoji = "•"
const phoneNumber = "255615858685"

const channelRD = {
    id: '120363398106360290@newsletter',
    name: '🅼🅸🅲🅺🅴🆈'
}

log('✓ ', chalk.green('CONFIG'), `Bot name: ${global.botname}`);
log('✓ ', chalk.green('CONFIG'), `Phone: ${phoneNumber}`);

// Fake serverMessageId ili ionekane realistic
const fakeServerMsgId = () => Math.floor(Math.random() * 10000) + 100

// ────────────────[ STORE & SETTINGS ]───────────────────
log('⚙️ ', chalk.cyan('STORE'), 'Initializing data store...');

const store = require('./lib/lightweight_store')
store.readFromFile()
log('✓ ', chalk.green('STORE'), 'Loaded from file');

const settings = require('./settings')

setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)
log('✓ ', chalk.green('STORE'), 'Auto-save enabled (interval: ' + (settings.storeWriteInterval || 10000) + 'ms)');

// Memory watchdog
log('⚙️ ', chalk.cyan('MEMORY'), 'Starting memory monitoring...');

setInterval(() => { if (global.gc) global.gc() }, 60000)
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 450) {
        console.log(chalk.bgRed.white('  ⚠️  MEMORY ALERT  ⚠️  '), chalk.red('RAM > 450MB → Restarting...'))
        process.exit(1)
    }
}, 30000)
log('✓ ', chalk.green('MEMORY'), 'Watchdog active (max: 450MB)');

console.log('');

// ────────────────[ PAIRING ]───────────────────
log('⚙️ ', chalk.cyan('AUTH'), 'Setting up authentication...');

const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code")
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null

const question = (text) => {
    if (rl) return new Promise(resolve => rl.question(text, resolve))
    return Promise.resolve(settings.ownerNumber || phoneNumber)
}

log('✓ ', chalk.green('AUTH'), `Pairing code: ${pairingCode ? 'ENABLED' : 'DISABLED'}`);

console.log('');

// ────────────────[ MAIN ]───────────────────
async function startXeonBotInc() {
    try {
        log('🚀', chalk.cyan('STARTUP'), 'Initializing bot connection...');
        console.log('');

        log('⏳', chalk.yellow('BAILEYS'), 'Fetching latest Baileys version...');
        const { version } = await fetchLatestBaileysVersion()
        log('✓ ', chalk.green('BAILEYS'), `Version fetched: ${version.major}.${version.minor}.${version.patch}`);

        log('⏳', chalk.yellow('SESSION'), 'Loading session authentication...');
        const { state, saveCreds } = await useMultiFileAuthState(`./session`)
        log('✓ ', chalk.green('SESSION'), 'Authentication state loaded');

        const msgRetryCounterCache = new NodeCache()
        log('✓ ', chalk.green('CACHE'), 'Message retry cache initialized');

        log('⏳', chalk.yellow('SOCKET'), 'Creating WhatsApp socket...');
        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid)
                let msg = await store.loadMessage(jid, key.id)
                return msg?.message || undefined
            },
            msgRetryCounterCache
        })
        log('✓ ', chalk.green('SOCKET'), 'WhatsApp socket created');

        log('⏳', chalk.yellow('HANDLERS'), 'Registering event handlers...');

        XeonBotInc.ev.on('creds.update', saveCreds)
        store.bind(XeonBotInc.ev)
        log('✓ ', chalk.green('HANDLERS'), 'Credential updates bound');

        // ──── Messages ────
        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages?.[0]
                if (!mek?.message) return

                if (mek.key?.remoteJid === 'status@broadcast') {
                    await handleStatus(XeonBotInc, chatUpdate)
                    return
                }

                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.log(chalk.bgRed.black('  ⚠️  MSG ERROR  ⚠️  '), chalk.red(err.message))
            }
        })
        log('✓ ', chalk.green('HANDLERS'), 'Message handler registered');

        // ──── Calls ────
        XeonBotInc.ev.on('call', async (call) => {
            try {
                await handleAnticall(XeonBotInc, { call })
            } catch (err) {
                console.log(chalk.bgRed.black('  ⚠️  CALL ERROR  ⚠️  '), chalk.red(err.message))
            }
        })
        log('✓ ', chalk.green('HANDLERS'), 'Call handler registered');

        console.log('');

        // ──── Connection ────
        XeonBotInc.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect } = s

            if (connection === 'open') {
                log('✨', chalk.green('CONNECTED'), 'Bot is online and ready!');
                console.log('');

                const botJid = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net'

                // Welcome message (with fake forward)
                const proCaption = `✨ *MICKEY GLITCH BOT* ✨
🟢 *Online & Ready*
📡 ${channelRD.name} | 💾 ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB
🎯 All Systems Operational`.trim()

                await XeonBotInc.sendMessage(botJid, {
                    text: proCaption,
                    contextInfo: {
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: channelRD.id,
                            newsletterName: channelRD.name,
                            serverMessageId: fakeServerMsgId()
                        },
                        externalAdReply: {
                            title: `ᴍɪᴄᴋᴇʏ ɢʟɪᴛᴄʜ ᴠ3.1.0`,
                            body: `Hosted by Mickey Glitch`,
                            thumbnailUrl: 'https://files.catbox.moe/jwdiuc.jpg',
                            sourceUrl: 'https://whatsapp.com/channel/0029VajVv9sEwEjw9T9S0C26',
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    }
                })
                log('📬', chalk.cyan('NOTIFY'), 'Startup message sent');

                // Auto-follow channel
                try {
                    await XeonBotInc.newsletterFollow(channelRD.id)
                    log('📢', chalk.blue('CHANNEL'), `Auto-followed: ${channelRD.name}`);
                } catch (err) {
                    log('⚠️ ', chalk.yellow('CHANNEL'), `Follow error: ${err.message}`);
                }

                const uptime = Math.round((Date.now() - startTime) / 1000);
                console.log('');
                console.log(chalk.bgGreen.black('═'.repeat(60)));
                log('✅', chalk.green('READY'), `Bot fully operational! (Startup: ${uptime}s)`);
                console.log(chalk.bgGreen.black('═'.repeat(60)));
                console.log('');
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
                if (shouldReconnect) {
                    log('🔄', chalk.yellow('RECONNECT'), 'Attempting to reconnect...');
                    startXeonBotInc()
                }
            }
        })

        // ──── sendMessage wrapper ── ALL bot messages appear forwarded from channel ────
        log('⚙️ ', chalk.cyan('WRAPPER'), 'Setting up sendMessage wrapper...');

        const originalSendMessage = XeonBotInc.sendMessage.bind(XeonBotInc)

        XeonBotInc.sendMessage = async (jid, content, options = {}) => {
            const originalContext = options.contextInfo || {}

            const skipFakeForward = 
                jid?.includes('@newsletter') ||
                jid === 'status@broadcast' ||
                content?.poll ||
                content?.buttonsMessage ||
                content?.templateMessage ||
                content?.listMessage ||
                options?.forward ||
                originalContext?.forwardedNewsletterMessageInfo

            if (skipFakeForward) {
                return originalSendMessage(jid, content, options)
            }

            // Delay kidogo ili ionekane natural
            const randomDelay = 400 + Math.floor(Math.random() * 1100)  // 400ms - 1500ms
            await delay(randomDelay)

            const fakeForwardContext = {
                ...originalContext,
                isForwarded: true,
                forwardingScore: 999,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: channelRD.id,
                    newsletterName: channelRD.name,
                    serverMessageId: fakeServerMsgId()
                }
            }

            if (originalContext.quotedMessage) {
                fakeForwardContext.quotedMessage = originalContext.quotedMessage
            }
            if (originalContext.mentionedJid) {
                fakeForwardContext.mentionedJid = originalContext.mentionedJid
            }

            options.contextInfo = fakeForwardContext

            return originalSendMessage(jid, content, options)
        }
        log('✓ ', chalk.green('WRAPPER'), 'Message wrapper configured');

        console.log('');

        // ──── Pairing code logic (CUSTOM: MICKDADY) ────
        if (pairingCode && !XeonBotInc.authState.creds.registered) {
            log('⏳', chalk.magenta('PAIRING'), 'Pairing code required');
            console.log(chalk.magenta('Tumia code maalum ili ku-pair bot'));
            console.log('');

            let number = (global.phoneNumber || await question(chalk.bgBlack(chalk.greenBright(`Weka namba ya simu (bila + au 0 mwanzo): `))))
                .replace(/[^0-9]/g, '')

            if (!number.startsWith('255')) {
                number = '255' + number
            }

            setTimeout(async () => {
                try {
                    // Custom pairing code - lazima iwe alphanumeric characters 8 tu
                    const customPairCode = "MICKDADY"

                    log('⏳', chalk.yellow('PAIRING'), `Attempting to pair with code: ${chalk.cyan.bold(customPairCode)}`);

                    const code = await XeonBotInc.requestPairingCode(number, customPairCode)

                    console.log('')
                    console.log(chalk.bgCyan.black('  🔐  CUSTOM PAIRING CODE  🔐  '))
                    console.log(chalk.cyan.bold('  ' + customPairCode))
                    console.log(chalk.yellow('→ Fungua WhatsApp kwenye simu yako'))
                    console.log(chalk.yellow('→ Nenda: Menu → Linked Devices → Link a device'))
                    console.log(chalk.yellow('→ Chagua "Link with phone number"'))
                    console.log(chalk.yellow('→ Weka namba yako halafu weka code hii: ') + chalk.green.bold(customPairCode))
                    console.log(chalk.gray('→ Thibitisha na subiri bot i-connect'))
                    console.log('')
                } catch (err) {
                    console.log(chalk.bgRed.black('  ❌  ERROR  ❌  '))
                    console.log(chalk.red(err.message || 'Tatizo la ku-pair'))
                    console.log(chalk.yellow('Vidokezo:'))
                    console.log(chalk.gray('1. Hakikisha namba ni sahihi (mfano: 255615858685)'))
                    console.log(chalk.gray('2. Code "MICKDADY" lazima iwe 8 characters tu'))
                    console.log(chalk.gray('3. Jaribu tena baada ya sekunde chache au badilisha code'))
                    console.log('')
                }
            }, 3000)
        }

        return XeonBotInc

    } catch (error) {
        console.log(chalk.bgRed.white('  ❌  STARTUP ERROR  ❌  '), chalk.red(error.message))
        log('⏳', chalk.yellow('RETRY'), 'Retrying in 8 seconds...');
        console.log('')
        await delay(8000)
        startXeonBotInc()
    }
}

startXeonBotInc()