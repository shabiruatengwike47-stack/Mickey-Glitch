/**
 * Silent Logger for Baileys
 * Suppresses noisy debug/info logs while preserving critical errors
 */
const pino = require('pino')

// Create a silent logger that only shows errors
const silentLogger = pino({
    level: 'silent',  // Suppress all logs by default
    transport: {
        target: 'pino/file',
        options: { destination: '/dev/null' }  // Send to null device
    }
})

// Helper to safely convert message to string
const msgToString = (msg) => {
    if (typeof msg === 'string') return msg
    if (msg instanceof Error) return msg.message || msg.toString()
    if (msg?.message) return String(msg.message)
    if (typeof msg === 'object' && msg !== null) {
        try {
            return JSON.stringify(msg)
        } catch {
            return Object.prototype.toString.call(msg)
        }
    }
    if (msg?.toString && typeof msg.toString === 'function') return msg.toString()
    return String(msg)
}

// Override with a custom logger
const customLogger = {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: (msg) => {
        const msgStr = msgToString(msg)
        
        // Filter out noisy protocol warnings
        if (msgStr.includes('"error":"479"') ||  // WhatsApp error 479
            msgStr.includes('Closing session') ||
            msgStr.includes('SessionEntry') ||
            msgStr.includes('prekey') ||
            msgStr.includes('Bad MAC')) {
            return
        }
        
        // Only show critical warnings with actual content
        if ((msgStr.includes('error') || msgStr.includes('Error')) && 
            msgStr !== '{"error":{}}' &&
            !msgStr.includes('"error":{}')) {
            process.stderr.write(`[WARN] ${msgStr}\n`)
        }
    },
    error: (msg) => {
        const msgStr = msgToString(msg)
        
        // Filter out empty or noisy session errors
        if (msgStr === '{"error":{}}' ||
            msgStr.includes('"error":{}') ||
            (msgStr.includes('"err":{}') && msgStr.includes('skmsg')) ||
            msgStr.includes('Closing session') || 
            msgStr.includes('SessionEntry') ||
            msgStr.includes('prekey') ||
            msgStr.includes('Bad MAC') ||
            msgStr.includes('decrypt') ||
            msgStr.includes('"error":"479"')) {
            return
        }
        
        process.stderr.write(`[ERROR] ${msgStr}\n`)
    },
    fatal: (msg) => {
        const msgStr = msgToString(msg)
        process.stderr.write(`[FATAL] ${msgStr}\n`)
    },
    child: () => customLogger  // Return self for child loggers
}

module.exports = customLogger
