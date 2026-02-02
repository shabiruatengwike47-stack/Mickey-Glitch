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
    delay
} = require("@whiskeysockets/baileys")

const pino = require("pino")
const readline = require("readline")

// ────────────────[ CONFIG ]───────────────────
global.botname = "𝙼𝚒𝚌𝚔𝚎𝚢 𝙶𝚕𝚒𝚝𝚌𝚑™"
const phoneNumber = "255615858685"
const channelRD = {
    id: '120363398106360290@newsletter',
    name: '🅼🅸🅲🅺🅴🆈'
}

// ────────────────[ MAIN ]───────────────────
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

        // ────────────────[ CONNECTION UPDATED WITH BUTTONS ]───────────────────
        XeonBotInc.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect } = s
            
            if (connection === 'open') {
                console.log(chalk.bgGreen.black('  ✨ CONNECTED  '))
                const botJid = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net'

                // Create the Button Message Structure
                const buttons = [
                    { buttonId: '.owner', buttonText: { displayText: '👤 Contact Owner' }, type: 1 },
                    { buttonId: '.menu', buttonText: { displayText: '📜 View Menu' }, type: 1 }
                ]

                const buttonMessage = {
                    text: `✨ *${global.botname}* is now Online!\n\nClick the button below to contact the developer or view commands.`,
                    footer: 'Powered by Mickey Glitch',
                    buttons: buttons,
                    headerType: 1,
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: channelRD.id,
                            newsletterName: channelRD.name,
                            serverMessageId: 100
                        }
                    }
                }

                // Send the button message
                await XeonBotInc.sendMessage(botJid, buttonMessage)
                
                try { await XeonBotInc.newsletterFollow(channelRD.id) } catch (err) {}
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
                if (shouldReconnect) startXeonBotInc()
            }
        })

        // ──── Message Handler (To process button clicks) ────
        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            const mek = chatUpdate.messages[0]
            if (!mek.message) return
            
            // This detects if a button was clicked
            const type = Object.keys(mek.message)[0]
            const body = (type === 'buttonsResponseMessage') ? mek.message.buttonsResponseMessage.selectedButtonId : 
                         (type === 'templateButtonReplyMessage') ? mek.message.templateButtonReplyMessage.selectedId : ''

            if (body) {
                console.log(chalk.cyan(`Button Clicked: ${body}`))
                // Pass the button ID as a command to your main handler
                await handleMessages(XeonBotInc, chatUpdate, true)
            } else {
                await handleMessages(XeonBotInc, chatUpdate, true)
            }
        })

        return XeonBotInc
    } catch (error) {
        await delay(5000)
        startXeonBotInc()
    }
}

startXeonBotInc()
