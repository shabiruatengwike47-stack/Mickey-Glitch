const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const { toAudio } = require('../lib/converter');

const AXIOS_DEFAULTS = {
    timeout: 40000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity'
    }
};

async function tryRequest(getter, maxAttempts = 4) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            const code = err?.response?.status || err?.code;
            if ([400, 403, 404, 451].includes(code)) throw err; // permanent errors
            if (code === 429 || ['ETIMEDOUT', 'ECONNABORTED', 'ECONNRESET'].includes(code)) {
                const delay = attempt === 1 ? 4000 : 8000 * (attempt - 1);
                console.log(`[Retry] ${code || 'unknown'} on attempt ${attempt} → wait ${delay/1000}s`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
        }
    }
    throw lastError || new Error('All attempts failed');
}

async function downloadAudioBufferFromYtdl(youtubeUrl) {
    try {
        console.log('[YTDL] Getting video info for:', youtubeUrl);
        const info = await ytdl.getInfo(youtubeUrl, { requestOptions: { headers: AXIOS_DEFAULTS.headers } });
        
        const audioFormat = ytdl.chooseFormat(info.formats, {
            quality: 'highestaudio',
            filter: 'audioonly'
        });
        
        if (!audioFormat) {
            throw new Error('No audio format available');
        }

        console.log('[YTDL] Selected format:', audioFormat.container, audioFormat.audioBitrate, 'kbps');

        const audioStream = ytdl.downloadFromInfo(info, {
            filter: 'audioonly',
            quality: 'highestaudio'
        });

        const chunks = [];
        let received = 0;

        audioStream.on('data', chunk => {
            chunks.push(chunk);
            received += chunk.length;
            if (received % (1024 * 1024) === 0) {
                console.log(`[Progress] ${ (received / 1024 / 1024).toFixed(1) } MB`);
            }
        });

        await new Promise((resolve, reject) => {
            audioStream.on('end', resolve);
            audioStream.on('error', err => reject(new Error(`Stream error: ${err.message}`)));
        });

        const buffer = Buffer.concat(chunks);

        if (buffer.length < 16000) {
            throw new Error(`Downloaded audio too small (${buffer.length} bytes)`);
        }

        console.log('[YTDL] Download complete:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');
        return { buffer, container: audioFormat.container || 'webm' };

    } catch (err) {
        console.error('[YTDL] Error:', err.message);
        throw err;
    }
}

async function songCommand(sock, chatId, message) {
    try {
        const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
        if (!text) {
            await sock.sendMessage(chatId, { text: 'Usage: .song <song name or YouTube link>' }, { quoted: message });
            return;
        }

        let video;
        if (text.includes('youtube.com') || text.includes('youtu.be')) {
            let url = text.startsWith('http') ? text : `https://${text}`;
            video = { url, title: 'YouTube Audio', timestamp: '—', thumbnail: '' };
        } else {
            const search = await yts(text);
            if (!search?.videos?.length) {
                await sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
                return;
            }
            video = search.videos[0];
        }

        await sock.sendMessage(chatId, {
            text: `🎵 Preparing *${video.title}*   ⏱ ${video.timestamp || '—'}`,
            contextInfo: {
                externalAdReply: {
                    title: video.title || 'Mickey Glitch Music',
                    body: 'Downloading & processing audio...',
                    thumbnailUrl: video.thumbnail,
                    sourceUrl: video.url || 'https://youtube.com',
                    mediaType: 1,
                    showAdAttribution: false,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: message });

        const { buffer: rawBuffer, container: fileExtension } = await downloadAudioBufferFromYtdl(video.url);

        // Basic signature check
        const head = rawBuffer.slice(0, 12);
        const isLikelyAudio =
            head.toString('ascii', 0, 3) === 'ID3' ||
            (head[0] === 0xFF && (head[1] & 0xE0) === 0xE0) ||
            head.toString('ascii', 0, 4) === 'OggS' ||
            head.toString('ascii', 4, 8) === 'ftyp' ||
            head.toString('ascii', 0, 4) === 'RIFF';

        if (!isLikelyAudio) {
            throw new Error('Downloaded content does not appear to be valid audio');
        }

        // Convert to MP3 if needed
        let finalBuffer = rawBuffer;
        let finalMimetype = 'audio/mpeg';

        if (fileExtension !== 'mp3') {
            console.log(`[Convert] ${fileExtension.toUpperCase()} → MP3`);
            finalBuffer = await toAudio(rawBuffer, fileExtension);
            if (!finalBuffer || finalBuffer.length < 16000) {
                throw new Error('Conversion failed - invalid output');
            }
        }

        // Send as audio
        await sock.sendMessage(chatId, {
            audio: finalBuffer,
            mimetype: finalMimetype,
            fileName: `${(video.title || 'song').replace(/[^a-z0-9]/gi, '_')}.mp3`,
            ptt: false
        }, { quoted: message });

        console.log('[Success] Audio file sent');

        // Cleanup temp files
        try {
            const tempDir = path.join(__dirname, '../temp');
            if (fs.existsSync(tempDir)) {
                const now = Date.now();
                fs.readdirSync(tempDir).forEach(file => {
                    const fp = path.join(tempDir, file);
                    if (now - fs.statSync(fp).mtimeMs > 15000 &&
                        (file.endsWith('.mp3') || file.endsWith('.m4a') || /^\d+\.(mp3|m4a)$/.test(file))) {
                        fs.unlinkSync(fp);
                    }
                });
            }
        } catch (cleanupErr) {
            console.log('[Cleanup] Ignored error:', cleanupErr.message);
        }

    } catch (err) {
        console.error('[ERROR]', err.message || err);

        let userMsg = '❌ Failed to process song.';
        const msg = (err.message || '').toLowerCase();

        if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('aborted') || msg.includes('connection') || msg.includes('incomplete')) {
            userMsg = '❌ Download was slow or interrupted. Try again or choose a shorter song.';
        } else if (msg.includes('corrupted') || msg.includes('small') || msg.includes('invalid') || msg.includes('conversion') || !msg.includes('audio')) {
            userMsg = '❌ Audio file corrupted or invalid. Try a different song.';
        } else if (msg.includes('no audio') || msg.includes('format')) {
            userMsg = '❌ No suitable audio available for this video.';
        }

        await sock.sendMessage(chatId, { text: userMsg }, { quoted: message });
    }
}

module.exports = songCommand;