require('./settings');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const chalk = require('chalk');
const readline = require("readline");
const { rmSync, existsSync } = require('fs');

// Hakikisha faili hili lipo na lina function ya handleStatusUpdate
const { handleMessages, handleStatusUpdate } = require('./main'); 

const sessionPath = `./session`;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startMickeyBot() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const conn = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        generateHighQualityLinkPreview: true,
        syncFullHistory: false
    });

    // --- PAIRING CODE LOGIC ---
    if (!conn.authState.creds.registered) {
        let num = await question(chalk.yellow("\nIngiza namba (Mfano: 255615944741): "));
        num = num.replace(/[^0-9]/g, '');
        setTimeout(async () => {
            try {
                const code = await conn.requestPairingCode(num, "MICKDADY");
                console.log(chalk.black.bgGreen(` CODE YAKO: `), chalk.bold.white(code));
            } catch (err) { console.log(chalk.red("Error pairing.")); }
        }, 3000);
    }

    conn.ev.on('creds.update', saveCreds);

    // --- MESSAGE HANDLER & STATUS LISTENER ---
    conn.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;

            // 1. ANGALIA KAMA NI STATUS (Hii ndio sehemu uliyotaka)
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                console.log(chalk.magenta(`[ NEW STATUS ] Meseji ya status imegundulika!`));
                // Tunaita handleStatusUpdate kutoka main.js
                await handleStatusUpdate(conn, chatUpdate);
                return;
            }

            // 2. KAMA NI MESEJI YA KAWAIDA
            await handleMessages(conn, chatUpdate);
            
        } catch (err) {
            console.log(chalk.red("[ ERROR ] Upsert:"), err.message);
        }
    });

    // --- CONNECTION UPDATES ---
    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(chalk.green.bold('\n✅ MICKEY GLITCH V3: ONLINE & STATUS READY'));
        }
        if (connection === 'close') {
            let reason = lastDisconnect?.error?.output?.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                rmSync(sessionPath, { recursive: true, force: true });
                process.exit(1);
            } else { startMickeyBot(); }
        }
    });

    return conn;
}

startMickeyBot();
