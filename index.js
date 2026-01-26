require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const PhoneNumber = require('awesome-phonenumber')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main')
const { smsg, getBuffer } = require('./lib/myfunc') // keep only needed

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    jidDecode,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")

const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { rmSync } = require('fs')

// store
const store = require('./lib/lightweight_store')
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

// ────────────────────────────────────────────────
const utilDelay = ms => new Promise(r => setTimeout(r, ms))

// Memory guard
setInterval(() => { if (global.gc) global.gc() }, 90000)

setInterval(() => {
    if (process.memoryUsage().rss / 1024 / 1024 > 420) {
        console.log(chalk.red('RAM >420MB → exit & restart'))
        process.exit(1)
    }
}, 30000)

// Globals
global.botname = "𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™"
global.themeemoji = "✦"

let phoneNumber = "255615858685"
let owner = []
try { owner = JSON.parse(fs.readFileSync('./data/owner.json', 'utf-8')) } catch {}

const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = text => rl ? new Promise(r => rl.question(text, r)) : Promise.resolve(settings.ownerNumber || phoneNumber)

// ────────────────────────────────────────────────
async function startXeonBotInc() {
    try {
        const { version } = await fetchLatestBaileysVersion()
        console.log(chalk.cyan(`Using WA proto version: ${version.join('.')}`))

        const { state, saveCreds } = await useMultiFileAuthState('./session')
        const msgRetryCounterCache = new NodeCache()

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: ["Ubuntu", "Chrome", "130.0"], // more recent & stable in 2026
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                const jid = jidNormalizedUser(key.remoteJid)
                const msg = await store.loadMessage(jid, key.id)
                return msg?.message || undefined
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 15000,
        })

        XeonBotInc.ev.on('creds.update', saveCreds)
        store.bind(XeonBotInc.ev)

        // ──── WORKING PAIRING BLOCK (copied from your original) ────────
        if (pairingCode && !XeonBotInc.authState.creds.registered) {
            if (useMobile) throw new Error('Cannot use pairing code with mobile api')

            let phoneNumberInput
            if (!!global.phoneNumber) {
                phoneNumberInput = global.phoneNumber
            } else {
                phoneNumberInput = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍\nFormat: 255615858685 : `)))
            }

            phoneNumberInput = phoneNumberInput.replace(/[^0-9]/g, '')
            const pn = require('awesome-phonenumber')
            if (!pn('+' + phoneNumberInput).isValid()) {
                console.log(chalk.red('Invalid number. Try again.'))
                process.exit(1)
            }

            setTimeout(async () => {
                try {
                    let code = await XeonBotInc.requestPairingCode(phoneNumberInput)
                    code = code?.match(/.{1,4}/g)?.join("-") || code
                    console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))

                    await utilDelay(2000)

                    const targetJid = phoneNumberInput + '@s.whatsapp.net'
                    await XeonBotInc.sendMessage(targetJid, {
                        text: `🔐 *Your Pairing Code*\n\n${code}\n\nUse this code to pair your device with Mickey Glitch Bot.`
                    })

                    console.log(chalk.green(`✅ Pairing code sent to ${phoneNumberInput}`))

                    XeonBotInc.ev.once('creds.update', async () => {
                        try {
                            await utilDelay(3000)
                            const credsPath = './session/creds.json'
                            if (fs.existsSync(credsPath)) {
                                const credsBuffer = fs.readFileSync(credsPath)
                                await XeonBotInc.sendMessage(targetJid, {
                                    document: credsBuffer,
                                    fileName: 'creds.json',
                                    mimetype: 'application/json',
                                    caption: '✅ Your credentials file. Keep it safe!'
                                })
                                console.log(chalk.green(`✅ Credentials sent to ${phoneNumberInput}`))
                            }
                        } catch (credsErr) {
                            console.error(chalk.red('Error sending credentials:'), credsErr?.message || credsErr)
                        }
                    })
                } catch (pairingErr) {
                    console.error(chalk.red('Pairing error:'), pairingErr?.message || pairingErr)
                    if (pairingErr?.output?.statusCode === 429) {
                        console.log(chalk.yellow('Rate limit → wait 10-30 min and retry'))
                    }
                }
            }, 3000)
        }

        // ──── WORKING messages.upsert BLOCK (copied & lightly improved) ───
        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages?.[0]
                if (!mek?.message) return

                if (Object.keys(mek.message)[0] === 'ephemeralMessage') {
                    mek.message = mek.message.ephemeralMessage.message
                }

                if (mek.key?.remoteJid === 'status@broadcast') {
                    await handleStatus(XeonBotInc, chatUpdate)
                    return
                }

                if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                    if (!isGroup) return
                }

                if (mek.key?.id?.startsWith('BAE5') && mek.key.id.length === 16) return

                if (XeonBotInc?.msgRetryCounterCache) {
                    XeonBotInc.msgRetryCounterCache.clear()
                }

                // Light debug so you confirm commands arrive
                let body = mek.message?.conversation || mek.message?.extendedTextMessage?.text || ''
                body = body.trim()
                if (body.startsWith('.')) {
                    console.log(chalk.bgYellow.black(`[CMD incoming] ${body} | From: ${mek.key.remoteJid}`))
                }

                try {
                    await handleMessages(XeonBotInc, chatUpdate, true)
                } catch (handlerErr) {
                    console.error(chalk.red("❌ Error in handleMessages:"), handlerErr?.stack || handlerErr)
                }
            } catch (err) {
                console.error(chalk.red("❌ Error in messages.upsert:"), err?.message || err)
            }
        })

        // ──── CONNECTION UPDATE (your improved version kept) ──────────
        XeonBotInc.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect } = s

            if (connection === 'connecting') {
                console.log(chalk.yellow('🔄 Connecting...'))
            }

            if (connection === 'open') {
                console.clear()
                console.log(chalk.black.bgGreen(`       ${global.botname} ONLINE       `))
                console.log(chalk.gray('═══════════════════════════════════════'))
                console.log(chalk.cyan(`• As → ${XeonBotInc.user?.name || XeonBotInc.user.id.split(':')[0]}`))
                console.log(chalk.cyan(`• Number → ${XeonBotInc.user.id.split(':')[0]}`))
                console.log(chalk.cyan(`• ${new Date().toLocaleString('en-GB')}`))
                console.log(chalk.gray('═══════════════════════════════════════'))

                const botJid = jidNormalizedUser(XeonBotInc.user.id)
                const onlineText = `✦ ───── ⋆⋅☆⋅⋆ ───── ✦

**${global.botname}** is now **online** ✓

• Started : ${new Date().toLocaleString()}
• Version : ${settings.version || 'unknown'}
• Mode    : ${XeonBotInc.public ? 'Public' : 'Private'}

Type *.menu* or *.help*

✦ ───── ⋆⋅☆⋅⋆ ───── ✦`

                await XeonBotInc.sendMessage(botJid, {
                    text: onlineText,
                    contextInfo: {
                        externalAdReply: {
                            title: `${global.botname} • Online`,
                            body: 'Connected ✓',
                            thumbnailUrl: 'https://files.catbox.moe/llc9v7.png',
                            sourceUrl: 'https://whatsapp.com/channel/0029VajVv9sEwEjw9T9S0C26',
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    }
                }).catch(() => {})

                // Update status/bio
                try {
                    await XeonBotInc.updateProfileStatus(`${global.themeemoji} ${global.botname} • Online • ${new Date().toLocaleDateString()}`)
                } catch {}

                // Auto-follow channel (your original)
                ;(async () => {
                    const channelId = '120363398106360290@newsletter'
                    if (!channelId) return
                    const methods = ['subscribeNewsletter', 'followChannel', 'subscribeToChannel']
                    for (const m of methods) {
                        if (typeof XeonBotInc[m] === 'function') {
                            try {
                                await XeonBotInc[m](channelId)
                                console.log(chalk.dim(`→ Channel followed via ${m}`))
                                return
                            } catch {}
                        }
                    }
                })()

                console.log(chalk.greenBright(`★ Bot ready ★\n`))
            }

            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode
                console.log(chalk.red(`Closed → \( {DisconnectReason[code] || 'Unknown'} ( \){code || '?'})`))

                const shouldReconnect = code !== DisconnectReason.loggedOut && code !== 401

                if (!shouldReconnect) {
                    console.log(chalk.yellow('Invalid session → deleting ./session'))
                    try { rmSync('./session', { recursive: true, force: true }) } catch {}
                }

                if (shouldReconnect) {
                    await utilDelay(6000)
                    startXeonBotInc()
                }
            }
        })

        // ──── Keep your other handlers ───────────────────────────────
        XeonBotInc.decodeJid = (jid) => { /* your original decode logic */ }
        XeonBotInc.getName = (jid, withoutContact = false) => { /* your original getName */ }
        XeonBotInc.public = true
        XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

        // Anticall (your original)
        const antiCallNotified = new Set()
        XeonBotInc.ev.on('call', async (calls) => {
            // ... paste your full anticall block here ...
        })

        XeonBotInc.ev.on('group-participants.update', async (update) => {
            try { await handleGroupParticipantUpdate(XeonBotInc, update) } catch (e) { console.error(e) }
        })

        return XeonBotInc

    } catch (error) {
        console.error(chalk.red('Fatal start error:'), error)
        await utilDelay(7000)
        startXeonBotInc()
    }
}

startXeonBotInc().catch(err => {
    console.error(chalk.bgRed('Critical fail:'), err)
    process.exit(1)
})

// Global error handlers + auto-reload (keep your original)
process.on('uncaughtException', err => console.error('Uncaught:', err))
process.on('unhandledRejection', reason => console.error('Unhandled:', reason))

if (process.env.NODE_ENV !== 'production') {
    const file = require.resolve(__filename)
    fs.watchFile(file, () => {
        fs.unwatchFile(file)
        console.log(chalk.redBright(`Reloading ${__filename}`))
        delete require.cache[file]
        require(file)
    })
}