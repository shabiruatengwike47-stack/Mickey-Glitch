require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, sleep, reSize } = require('./lib/myfunc')
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
const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { rmSync, existsSync } = require('fs')

// --- CONFIGURATION ---
const channelRD = { id: '120363398106360290@newsletter', name: 'Mickey From Tanzania' };
global.botname = "𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™"
global.themeemoji = "•"
let phoneNumber = "255615858685"

// Import lightweight store
const store = require('./lib/lightweight_store')
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

// Memory optimization
setInterval(() => {
    if (global.gc) global.gc()
}, 60_000)

setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 450) process.exit(1)
}, 30_000)

const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code")
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null

const question = (text) => {
    if (rl) return new Promise((resolve) => rl.question(text, resolve))
    return Promise.resolve(settings.ownerNumber || phoneNumber)
}

async function startXeonBotInc() {
    try {
        let { version } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState(`./session`)
        const msgRetryCounterCache = new NodeCache()

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
                return msg?.message || ""
            },
            msgRetryCounterCache
        })

        // Newsletter Forwarding Context Helper
        const newsletterForward = {
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: channelRD.id,
                    newsletterName: channelRD.name,
                    serverMessageId: 143
                }
            }
        }

        // ================= [ BUTTON FUNCTION ENGINE ] =================
        XeonBotInc.sendButton = async (jid, text, footer, buttons, quoted, options = {}) => {
            let messageButtons = buttons.map(btn => ({
                buttonId: btn.id,
                buttonText: { displayText: btn.displayText },
                type: 1
            }))

            let buttonMessage = {
                text: text,
                footer: footer,
                buttons: messageButtons,
                headerType: 1,
                viewOnce: true,
                ...newsletterForward // Apply newsletter info to buttons
            }

            if (options.image) {
                const media = await prepareWAMessageMedia({ image: options.image }, { upload: XeonBotInc.waUploadToServer })
                buttonMessage.imageMessage = media.imageMessage
                buttonMessage.headerType = 4
            } else if (options.video) {
                const media = await prepareWAMessageMedia({ video: options.video }, { upload: XeonBotInc.waUploadToServer })
                buttonMessage.videoMessage = media.videoMessage
                buttonMessage.headerType = 5
            }

            const msg = generateWAMessageFromContent(jid, { buttonsMessage: buttonMessage }, { quoted, userJid: XeonBotInc.user.id })
            await XeonBotInc.relayMessage(jid, msg.message, { messageId: msg.key.id })
            return msg
        }

        XeonBotInc.ev.on('creds.update', saveCreds)
        store.bind(XeonBotInc.ev)

        // Message handling
        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages?.[0]
                if (!mek?.message) return

                const type = Object.keys(mek.message)[0]
                const buttonId = (type === 'buttonsResponseMessage') ? mek.message.buttonsResponseMessage.selectedButtonId : 
                                 (type === 'templateButtonReplyMessage') ? mek.message.templateButtonReplyMessage.selectedId : 
                                 (type === 'listResponseMessage') ? mek.message.listResponseMessage.singleSelectReply.selectedRowId : null

                if (buttonId) mek.body = buttonId 

                if (mek.key?.remoteJid === 'status@broadcast') {
                    await handleStatus(XeonBotInc, chatUpdate)
                    return
                }

                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error("Error in messages.upsert:", err)
            }
        })

        XeonBotInc.decodeJid = (jid) => {
            if (!jid) return jid
            if (/:\d+@/gi.test(jid)) {
                let decode = jidDecode(jid) || {}
                return decode.user && decode.server && decode.user + '@' + decode.server || jid
            } else return jid
        }

        // Connection Update
        XeonBotInc.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect } = s
            if (connection === 'open') {
                console.log(chalk.green(`${global.themeemoji} Bot Connected Successfully! ✅`))
                
                const botJid = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net'
                
                // Send Video with Newsletter Forwarding Info
                await XeonBotInc.sendMessage(botJid, { 
                    video: { url: 'https://files.catbox.moe/usg5b4.mp4' }, 
                    caption: `✨ *${global.botname}* is now online!`,
                    ...newsletterForward
                })
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
                if (shouldReconnect) startXeonBotInc()
            }
        })

        // Pairing Code Logic
        if (pairingCode && !XeonBotInc.authState.creds.registered) {
            let phoneNumberInput = (global.phoneNumber || await question(chalk.bgBlack(chalk.greenBright(`Input Number: `)))).replace(/[^0-9]/g, '')
            setTimeout(async () => {
                let code = await XeonBotInc.requestPairingCode(phoneNumberInput)
                console.log(chalk.black(chalk.bgGreen(`Pairing Code:`)), chalk.white(code?.match(/.{1,4}/g)?.join("-")))
            }, 3000)
        }

        return XeonBotInc

    } catch (error) {
        console.error('Startup Error:', error)
        await delay(5000)
        startXeonBotInc()
    }
}

startXeonBotInc()
