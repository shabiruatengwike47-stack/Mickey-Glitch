/**
 * Song command - Downloads audio directly from YouTube using @distube/ytdl-core
 * Converts to MP3 using your ffmpeg-based toAudio function
 * Sends as WhatsApp audio message
 */

const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const ytdl = require('@distube/ytdl-core'); // ← Install: npm i @distube/ytdl-core@latest

// Your converter (copied exactly as provided)
const { toAudio } = require('../lib/converter'); // assuming this exports { toAudio, ... }

const AXIOS_DEFAULTS = {
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity'
    }
};

async function downloadAudioBuffer(youtubeUrl) {
    console.log('[YTDL] Starting download for:', youtubeUrl);

    const info = await ytdl.getInfo(youtubeUrl, {
        requestOptions: { headers: AXIOS_DEFAULTS.headers }
    });

    const format = ytdl.chooseFormat(info.formats, {
        filter: 'audioonly',
        quality: 'highestaudio'
    });

    if (!format) {
        throw new Error('No suitable audio format found');
    }

    console.log('[YTDL] Selected format:', format.mimeType, format.audioBitrate || 'unknown', 'kbps');

    return new Promise((resolve, reject) => {
        const stream = ytdl.downloadFromInfo(info, {
            format,
            requestOptions: { headers: AXIOS_DEFAULTS.headers }
        });

        const chunks = [];
        let totalReceived = 0;

        stream.on('data', (chunk) => {
            chunks.push(chunk);
            totalReceived += chunk.length;
            if (totalReceived % (1024 * 1024) === 0) {
                console.log(`[Progress] ${ (totalReceived / 1024 / 1024).toFixed(2) } MB`);
            }
        });

        stream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            console.log('[YTDL] Download finished:', (buffer.length / 1024 / 1024).toFixed(2), 'MB');
            if (buffer.length < 32000) {
                reject(new Error('Downloaded audio too small - likely failed'));
            } else {
                resolve({ buffer, container: format.container || 'webm' });
            }
        });

        stream.on('error', (err) => {
            console.error('[YTDL] Stream error:', err.message);
            reject(err);
        });
    });
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
            let url = text;
            if (!url.startsWith('http')) url = 'https://' + url;
            video = { url, title: 'YouTube Audio', timestamp: '—', thumbnail: '' };
        } else {
            console.log('[Search] Query:', text);
            const search = await yts(text);
            if (!search?.videos?.length) {
                await sock.sendMessage(chatId, { text: '❌ No results found for that song.' }, { quoted: message });
                return;
            }
            video = search.videos[0];
            console.log('[Search] Selected:', video.title, video.url);
        }

        // Nice notification with thumbnail
        await sock.sendMessage(chatId, {
            text: `🎵 Preparing: *${video.title}*\n⏱ Duration: ${video.timestamp || 'Unknown'}`,
            contextInfo: {
                externalAdReply: {
                    title: video.title || 'Mickey Glitch Music',
                    body: 'Downloading audio... (may take 10–60s)',
                    thumbnailUrl: video.thumbnail,
                    sourceUrl: video.url || 'https://youtube.com',
                    mediaType: 1,
                    showAdAttribution: false,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: message });

        // 1. Download raw audio (usually webm/opus or m4a)
        const { buffer: rawBuffer, container } = await downloadAudioBuffer(video.url);

        // 2. Basic validation
        const head = rawBuffer.slice(0, 12);
        const looksLikeAudio =
            head.toString('ascii', 0, 3) === 'ID3' ||
            (head[0] === 0xFF && (head[1] & 0xE0) === 0xE0) ||
            head.toString('ascii', 0, 4) === 'OggS' ||
            head.toString('ascii', 4, 8) === 'ftyp';

        if (!looksLikeAudio) {
            throw new Error('Downloaded content does not look like valid audio');
        }

        // 3. Convert to MP3 using your ffmpeg function
        let finalBuffer;
        if (container === 'mp3') {
            console.log('[Convert] Already MP3 - skipping conversion');
            finalBuffer = rawBuffer;
        } else {
            console.log(`[Convert] ${container.toUpperCase()} → MP3`);
            finalBuffer = await toAudio(rawBuffer, container);
            if (!finalBuffer || finalBuffer.length < 32000) {
                throw new Error('Conversion returned empty or too small buffer');
            }
        }

        // 4. Send as audio message
        const titleSafe = (video.title || 'song').replace(/[^a-z0-9 ]/gi, '_').substring(0, 60);
        await sock.sendMessage(chatId, {
            audio: finalBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${titleSafe}.mp3`,
            ptt: false // normal audio player, not voice note
        }, { quoted: message });

        console.log('[Success] Audio sent');

        // 5. Cleanup (your original logic)
        try {
            const tempDir = path.join(__dirname, '../temp');
            if (fs.existsSync(tempDir)) {
                const now = Date.now();
                fs.readdirSync(tempDir).forEach(file => {
                    const fp = path.join(tempDir, file);
                    try {
                        const stats = fs.statSync(fp);
                        if (now - stats.mtimeMs > 15000 &&
                            (file.endsWith('.mp3') || file.endsWith('.m4a') || file.endsWith('.webm') || /^\d+\.(mp3|m4a|webm)$/.test(file))) {
                            fs.unlinkSync(fp);
                        }
                    } catch {}
                });
            }
        } catch (cleanupErr) {
            console.log('[Cleanup] Ignored:', cleanupErr.message);
        }

    } catch (err) {
        console.error('[ERROR]', err.message || err);

        let userMsg = '❌ Failed to download or process song.';
        const msg = (err.message || '').toLowerCase();

        if (msg.includes('no suitable') || msg.includes('format')) {
            userMsg = '❌ No audio stream available for this video. Try another.';
        } else if (msg.includes('timeout') || msg.includes('connection') || msg.includes('network')) {
            userMsg = '❌ Connection was slow or interrupted. Try again later.';
        } else if (msg.includes('corrupted') || msg.includes('small') || msg.includes('conversion')) {
            userMsg = '❌ Audio processing failed. Try a different song.';
        }

        await sock.sendMessage(chatId, { text: userMsg }, { quoted: message });
    }
}

module.exports = songCommand;