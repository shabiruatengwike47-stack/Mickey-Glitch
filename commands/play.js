const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const YTDlpWrap = require('yt-dlp-wrap').default;
const { toAudio } = require('../lib/converter');

// Path to yt-dlp binary (will auto-download on first run if missing)
const ytDlpBinaryPath = path.join(__dirname, 'yt-dlp');
const ytDlp = new YTDlpWrap(ytDlpBinaryPath);

async function downloadAudioWithYtdlp(videoUrl) {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const outputPath = path.join(tempDir, `${Date.now()}_audio.%(ext)s`);

    try {
        console.log('[yt-dlp] Downloading audio from:', videoUrl);

        await ytDlp.execPromise([
            videoUrl,
            '-f', 'bestaudio/best',
            '--audio-format', 'best',
            '--no-playlist',
            '-o', outputPath,
            '--quiet',
            '--no-warnings',
            '--embed-thumbnail',
            '--add-metadata'
        ]);

        // Find the actual downloaded file (yt-dlp uses wildcards)
        const files = fs.readdirSync(tempDir);
        const audioFile = files.find(f => f.startsWith(`\( {path.basename(outputPath).split('.')[0]}`) && /\.(webm|m4a|opus|mp3) \)/i.test(f));

        if (!audioFile) throw new Error('No audio file created by yt-dlp');

        const fullPath = path.join(tempDir, audioFile);
        const buffer = await fs.promises.readFile(fullPath);

        // Clean up immediately
        await fs.promises.unlink(fullPath).catch(() => {});

        const ext = path.extname(audioFile).slice(1).toLowerCase() || 'webm';
        console.log(`[yt-dlp] Success - ${ext.toUpperCase()} - ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

        return { buffer, ext };

    } catch (err) {
        // Clean up any leftover files
        fs.readdirSync(tempDir).forEach(file => {
            if (file.includes('audio')) fs.unlinkSync(path.join(tempDir, file)).catch(() => {});
        });
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

        // Send preview
        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: `🎵 Processing: *${video.title}*\n⏱ ${video.timestamp || '—'}\n\n(using stable downloader)`
        }, { quoted: message });

        const { buffer: rawBuffer, ext: fileExtension } = await downloadAudioWithYtdlp(video.url);

        if (!rawBuffer || rawBuffer.length < 32000) {
            throw new Error('Downloaded file too small or empty');
        }

        // Convert to MP3 using your existing function
        let finalBuffer = rawBuffer;
        let finalMimetype = 'audio/mpeg';
        let finalExt = 'mp3';

        if (!['mp3'].includes(fileExtension.toLowerCase())) {
            console.log(`[Convert] ${fileExtension.toUpperCase()} → MP3`);
            finalBuffer = await toAudio(rawBuffer, fileExtension);
            if (!finalBuffer || finalBuffer.length < 32000) {
                throw new Error('Conversion failed - output invalid/empty');
            }
        }

        // Send as audio
        const safeTitle = (video.title || 'audio').replace(/[^a-z0-9 ]/gi, '_').slice(0, 50);
        await sock.sendMessage(chatId, {
            audio: finalBuffer,
            mimetype: finalMimetype,
            fileName: `\( {safeTitle}. \){finalExt}`,
            ptt: false
        }, { quoted: message });

        console.log('[Success] Audio sent');

    } catch (err) {
        console.error('[Song] Error:', err.message || err);

        let userMsg = '❌ Failed to download or process song.';
        const msg = (err.message || '').toLowerCase();

        if (msg.includes('signature') || msg.includes('format') || msg.includes('yt-dlp')) {
            userMsg = '❌ Download issue (YouTube protection). Try again in a few minutes or different song.';
        } else if (msg.includes('timeout') || msg.includes('connection')) {
            userMsg = '❌ Slow/unstable connection. Try again later.';
        } else if (msg.includes('conversion') || msg.includes('small') || msg.includes('empty')) {
            userMsg = '❌ Audio file corrupted or too small after download. Try another song.';
        }

        await sock.sendMessage(chatId, { text: userMsg }, { quoted: message });
    }
}

module.exports = songCommand;