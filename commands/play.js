const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
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

async function getYupraDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    console.log('[Yupra] Request:', apiUrl);
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url?.startsWith('http')) {
        return {
            download: res.data.data.download_url,
            title: res.data.data.title || 'Unknown',
            thumbnail: res.data.data.thumbnail || ''
        };
    }
    throw new Error('Yupra: No valid download URL');
}

async function getOkatsuDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    console.log('[Okatsu] Request:', apiUrl);
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.dl?.startsWith('http')) {
        return {
            download: res.data.dl,
            title: res.data.title || 'Unknown',
            thumbnail: res.data.thumb || ''
        };
    }
    throw new Error('Okatsu: No valid download URL');
}

async function downloadAudioBufferFromUrl(audioUrl) {
    const config = {
        responseType: 'stream',
        timeout: 240000, // 4 minutes - most songs <10 MB, gives room for slow proxies
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
            ...AXIOS_DEFAULTS.headers
        }
    };

    console.log('[Download] Streaming from:', audioUrl.substring(0, 70) + '...');

    const response = await axios.get(audioUrl, config);
    const contentLength = parseInt(response.headers['content-length'] || '0', 10);

    const chunks = [];
    let received = 0;

    response.data.on('data', chunk => {
        chunks.push(chunk);
        received += chunk.length;
        if (received % (1024 * 1024) === 0) { // log every MB
            console.log(`[Progress] ${ (received / 1024 / 1024).toFixed(1) } MB`);
        }
    });

    await new Promise((resolve, reject) => {
        response.data.on('end', resolve);
        response.data.on('error', err => reject(new Error(`Stream error: ${err.message}`)));
    });

    const buffer = Buffer.concat(chunks);

    if (contentLength > 0 && received < contentLength * 0.92) {
        throw new Error(`Incomplete file: got \( {received} bytes, expected ~ \){contentLength}`);
    }

    if (buffer.length < 16000) {
        throw new Error(`Downloaded file too small (${buffer.length} bytes) - likely failed`);
    }

    console.log('[Download] Complete:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');
    return buffer;
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

        let audioData;
        try {
            audioData = await getYupraDownloadByUrl(video.url);
            console.log('[Yupra] Success');
        } catch (e1) {
            console.log('[Fallback] Yupra failed:', e1.message);
            audioData = await getOkatsuDownloadByUrl(video.url);
            console.log('[Okatsu] Success');
        }

        const audioUrl = audioData.download;
        if (!audioUrl?.startsWith('http')) {
            throw new Error('Invalid download URL from API');
        }

        const rawBuffer = await downloadAudioBufferFromUrl(audioUrl);

        // Basic signature check to catch obvious non-audio
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

        // Detect & convert to MP3
        let fileExtension = 'm4a'; // default for many converters
        if (head.toString('ascii', 0, 3) === 'ID3' || (head[0] === 0xFF && (head[1] & 0xE0) === 0xE0)) {
            fileExtension = 'mp3';
        } else if (head.toString('ascii', 0, 4) === 'OggS') {
            fileExtension = 'ogg';
        } else if (head.toString('ascii', 4, 8) === 'ftyp') {
            fileExtension = 'm4a';
        }

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
            fileName: `${(audioData.title || video.title || 'song').replace(/[^a-z0-9]/gi, '_')}.mp3`,
            ptt: false // voice note = false → normal audio file
        }, { quoted: message });

        console.log('[Success] Audio file sent');

        // Your cleanup logic
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
            userMsg = '❌ Audio file corrupted or invalid from server. Try a different song.';
        } else if (msg.includes('api') || msg.includes('no valid') || msg.includes('url')) {
            userMsg = '❌ Download service issue right now. Try again later.';
        }

        await sock.sendMessage(chatId, { text: userMsg }, { quoted: message });
    }
}

module.exports = songCommand;