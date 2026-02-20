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

// Override with a custom logger
const customLogger = {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: (msg) => {
        // Only show critical warnings
        if (msg?.includes('error') || msg?.includes('Error')) {
            process.stderr.write(`[WARN] ${msg}\n`)
        }
    },
    error: (msg) => {
        // Only show non-session errors
        if (!msg?.includes('Closing session') && 
            !msg?.includes('SessionEntry') &&
            !msg?.includes('prekey') &&
            !msg?.includes('Bad MAC') &&
            !msg?.includes('decrypt')) {
            process.stderr.write(`[ERROR] ${msg}\n`)
        }
    },
    fatal: (msg) => {
        process.stderr.write(`[FATAL] ${msg}\n`)
    },
    child: () => customLogger  // Return self for child loggers
}

module.exports = customLogger
