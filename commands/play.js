const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { toAudio } = require('../lib/converter');

const AXIOS_DEFAULTS = {
    timeout: 45000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'identity'   // ← Critical: prevent gzip/deflate corruption
    }
};

async function tryRequest(getter, maxAttempts = 4) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            const code = err?.response?.status;
            if ([400, 403, 404, 451].includes(code)) throw err; // permanent → no retry
            if (code === 429) await new Promise(r => setTimeout(r, 7000 * attempt));
            else if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1800 * attempt));
        }
    }
    throw lastError;
}

async function getYupraDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    console.log('[Yupra] Fetching:', apiUrl);
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url?.startsWith('http')) {
        return {
            download: res.data.data.download_url,
            title: res.data.data.title || 'Unknown',
            thumbnail: res.data.data.thumbnail || ''
        };
    }
    throw new Error('Yupra invalid response');
}

async function getOkatsuDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    console.log('[Okatsu] Fetching:', apiUrl);
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.dl?.startsWith('http')) {
        return {
            download: res.data.dl,
            title: res.data.title || 'Unknown',
            thumbnail: res.data.thumb || ''
        };
    }
    throw new Error('Okatsu invalid response');
}

async function songCommand(sock, chatId, message) {
    try {
        const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
        if (!text) {
            await sock.sendMessage(chatId, { text: 'Usage: .song <song name or link>' }, { quoted: message });
            return;
        }

        let video;
        if (text.includes('youtube.com') || text.includes('youtu.be')) {
            video = { url: text.startsWith('http') ? text : 'https://' + text, title: 'YouTube Audio' };
        } else {
            const search = await yts(text);
            if (!search?.videos?.length) {
                await sock.sendMessage(chatId, { text: '❌ No results found for that song.' }, { quoted: message });
                return;
            }
            video = search.videos[0];
        }

        // Notify user
        await sock.sendMessage(chatId, {
            text: `🎵 Preparing: *${video.title || 'Audio'}*\n⏱ ${video.timestamp || '—'}`,
            contextInfo: {
                externalAdReply: {
                    title: video.title || 'Mickey Glitch Music',
                    body: 'Fetching audio...',
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
            console.log('[Success] Yupra URL:', audioData.download.substring(0, 60) + '...');
        } catch (e1) {
            console.log('[Fallback] Yupra failed →', e1.message);
            audioData = await getOkatsuDownloadByUrl(video.url);
            console.log('[Success] Okatsu URL:', audioData.download.substring(0, 60) + '...');
        }

        const audioUrl = audioData.download;
        if (!audioUrl || !audioUrl.startsWith('http')) {
            throw new Error('Invalid download URL from API');
        }

        // ─── Download with safeguards ───────────────────────────────────────
        const downloadConfig = {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            decompress: false,           // ← Important: let us control it
            validateStatus: s => s >= 200 && s < 400,
            headers: {
                ...AXIOS_DEFAULTS.headers,
                'Accept-Encoding': 'identity'
            }
        };

        let audioBuffer;
        try {
            console.log('[Download] Attempting arraybuffer...');
            const res = await axios.get(audioUrl, downloadConfig);
            audioBuffer = Buffer.from(res.data);
        } catch (err) {
            console.log('[Download] Arraybuffer failed:', err.message);
            throw new Error('Download failed (network/server issue)');
        }

        if (!audioBuffer || audioBuffer.length < 8000) { // arbitrary small threshold
            console.error('[Validation] Buffer too small:', audioBuffer?.length || 0);
            throw new Error('Downloaded file too small - likely corrupted or empty');
        }

        // Very basic corruption check (magic numbers)
        const head = audioBuffer.slice(0, 12);
        const isProbablyValid =
            head.toString('ascii', 0, 3) === 'ID3' ||
            (head[0] === 0xFF && (head[1] & 0xE0) === 0xE0) ||
            head.toString('ascii', 0, 4) === 'OggS' ||
            head.toString('ascii', 4, 8) === 'ftyp' ||
            head.toString('ascii', 0, 4) === 'RIFF';

        if (!isProbablyValid) {
            console.error('[Validation] No known audio signature detected');
            throw new Error('Downloaded content does not look like valid audio');
        }

        console.log('[Download] Buffer OK:', audioBuffer.length, 'bytes');

        // ─── Format detection & conversion (your original logic, slightly tightened) ───
        let fileExtension = 'm4a'; // default assumption for most ytmp3 APIs
        let detectedFormat = 'M4A/MP4';

        const asciiSig = head.toString('ascii', 4, 8);
        if (asciiSig === 'ftyp') {
            fileExtension = 'm4a';
        } else if (head.toString('ascii', 0, 3) === 'ID3' || (head[0] === 0xFF && (head[1] & 0xE0) === 0xE0)) {
            fileExtension = 'mp3';
            detectedFormat = 'MP3';
        } else if (head.toString('ascii', 0, 4) === 'OggS') {
            fileExtension = 'ogg';
            detectedFormat = 'OGG';
        } else if (head.toString('ascii', 0, 4) === 'RIFF') {
            fileExtension = 'wav';
            detectedFormat = 'WAV';
        }

        let finalBuffer = audioBuffer;
        let finalMimetype = fileExtension === 'mp3' ? 'audio/mpeg' : 'audio/mp4';

        if (fileExtension !== 'mp3') {
            console.log(`[Convert] ${detectedFormat} → MP3`);
            finalBuffer = await toAudio(audioBuffer, fileExtension);
            if (!finalBuffer || finalBuffer.length < 16000) {
                throw new Error('Conversion failed - output invalid');
            }
            finalMimetype = 'audio/mpeg';
            fileExtension = 'mp3';
        }

        // Send
        await sock.sendMessage(chatId, {
            audio: finalBuffer,
            mimetype: finalMimetype,
            fileName: `${(audioData.title || video.title || 'audio').replace(/[^a-z0-9]/gi, '_')}.mp3`,
            ptt: false
        }, { quoted: message });

        console.log('[Success] Audio sent');

        // Cleanup (your original)
        try {
            const tempDir = path.join(__dirname, '../temp');
            if (fs.existsSync(tempDir)) {
                fs.readdirSync(tempDir).forEach(file => {
                    const fp = path.join(tempDir, file);
                    const stats = fs.statSync(fp);
                    if (Date.now() - stats.mtimeMs > 15000 && (file.endsWith('.mp3') || file.endsWith('.m4a') || /^\d+\.(mp3|m4a)$/.test(file))) {
                        fs.unlinkSync(fp);
                    }
                });
            }
        } catch {}

    } catch (err) {
        console.error('[ERROR]', err.message || err);

        let userMsg = '❌ Failed to process song.';
        const msg = (err.message || '').toLowerCase();

        if (msg.includes('invalid') || msg.includes('no download') || msg.includes('api')) {
            userMsg = '❌ Download service issue. Try again later.';
        } else if (msg.includes('corrupted') || msg.includes('empty') || msg.includes('small') || msg.includes('signature') || msg.includes('conversion failed')) {
            userMsg = '❌ Audio file corrupted or incomplete. Try a different song.';
        } else if (msg.includes('network') || msg.includes('timeout')) {
            userMsg = '❌ Slow or unstable connection. Try again.';
        }

        await sock.sendMessage(chatId, { text: userMsg }, { quoted: message });
    }
}

module.exports = songCommand;