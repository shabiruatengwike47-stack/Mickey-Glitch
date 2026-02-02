require('dotenv').config()
require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main')
const { handleAnticall } = require('./commands/anticall')

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateWAMessageFromContent,
    prepareWAMessageMedia,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay,
    proto
} = require("@whiskeysockets/baileys")

const pino = require("pino")

// ────────────────[ CONFIG ]───────────────────
global.botname = "𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™"
const phoneNumber = "255615858685"
const channelRD = {
    id: '120363398106360290@newsletter',
    name: '🅼🅸🅲🅺🅴🆈'
}

async function startXeonBotInc() {
    try {
        const { version } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState(`./session`)

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
        })

        XeonBotInc.ev.on('creds.update', saveCreds)

        // ────────────────[ CONNECTION & BUTTON SENDING ]───────────────────
        XeonBotInc.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect } = s
            
            if (connection === 'open') {
                console.log(chalk.bgGreen.black('  ✨ CONNECTED  '))
                const botJid = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net'

                // MODERNISED INTERACTIVE BUTTON METHOD
                const msg = generateWAMessageFromContent(botJid, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                                body: proto.Message.InteractiveMessage.Body.fromObject({
                                    text: `✨ *${global.botname}* ONLINE\n\nClick below to access owner details.`
                                }),
                                footer: proto.Message.InteractiveMessage.Footer.fromObject({
                                    text: "Powered by Mickey Glitch"
                                }),
                                header: proto.Message.InteractiveMessage.Header.fromObject({
                                    title: "All Systems Operational",
                                    hasMediaAttachment: false
                                }),
                                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                    buttons: [
                                        {
                                            "name": "quick_reply",
                                            "buttonParamsJson": `{"display_text":"👤 OWNER","id":".owner"}`
                                        },
                                        {
                                            "name": "quick_reply",
                                            "buttonParamsJson": `{"display_text":"📜 MENU","id":".menu"}`
                                        }
                                    ]
                                }),
                                contextInfo: {
                                    forwardingScore: 999,
                                    isForwarded: true,
                                    forwardedNewsletterMessageInfo: {
                                        newsletterJid: channelRD.id,
                                        newsletterName: channelRD.name,
                                        serverMessageId: 1
                                    }
                                }
                            })
                        }
                    }
                }, {})

                await XeonBotInc.relayMessage(botJid, msg.message, { messageId: msg.key.id })
            }

            if (connection === 'close') {
                if ((lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut) startXeonBotInc()
            }
        })

        // ────────────────[ BUTTON HANDLER ]───────────────────
        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            const mek = chatUpdate.messages[0]
            if (!mek.message) return

            // Logic to extract button ID from Interactive Messages
            const interactiveResponse = mek.message.interactiveResponseMessage
            if (interactiveResponse) {
                const params = JSON.parse(interactiveResponse.nativeFlowResponseMessage.paramsJson)
                mek.body = params.id // Set the body to the button ID (e.g., .owner)
            }

            await handleMessages(XeonBotInc, chatUpdate, true)
        })

        return XeonBotInc
    } catch (error) {
        await delay(5000)
        startXeonBotInc()
    }
}

startXeonBotInc()
