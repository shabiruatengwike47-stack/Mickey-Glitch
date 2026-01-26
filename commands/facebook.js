const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function facebookCommand(sock, chatId, message) {
    try {
        let text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        let url = text.split(' ').slice(1).join(' ').trim();

        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: '📹 *Facebook Downloader*\n\nUsage: .fb <link>\nExample:\n.fb https://www.facebook.com/share/r/16sXMhKi6e/\n.fb https://fb.watch/abc123/' 
            }, { quoted: message });
        }

        // Very light normalization – only remove leading/trailing spaces and fix protocol if missing
        url = url.trim();
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }

        // Quick check
        if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
            return await sock.sendMessage(chatId, { text: '❌ This does not appear to be a Facebook link.' }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // ────────────────────────────────────────────────
        // CLEAN API CALL – exactly as you requested
        // No added characters, no extra encoding beyond standard encodeURIComponent
        // ────────────────────────────────────────────────
        const apiUrl = `https://api.vreden.my.id/api/v1/download/facebook?url=${encodeURIComponent(url)}`;

        const res = await axios.get(apiUrl, {
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            validateStatus: status => status < 600
        });

        const data = res.data || {};

        // ── Show exact API reply when failed ───────────────────────────
        if (!data.status || data.status !== true) {
            let apiMessage = data.message || data.error || data.msg || JSON.stringify(data);

            // Make common Indonesian messages more understandable
            if (apiMessage.includes('Masukan link') || apiMessage.includes('valid') || apiMessage.includes('benar')) {
                apiMessage = 'Invalid or unsupported link format.\nMake sure it is a **public** Facebook video/reel.';
            } else if (apiMessage.toLowerCase().includes('private') || apiMessage.includes('restricted')) {
                apiMessage = 'This video appears to be private or restricted.';
            }

            return await sock.sendMessage(chatId, { 
                text: `❌ Failed\n\nAPI response:\n${apiMessage}\n\nTry a different public video.` 
            }, { quoted: message });
        }

        // ── Success path ──────────────────────────────────────────────
        let videoUrl = null;
        let quality = 'Unknown';

        if (data.result?.download?.hd?.startsWith('http')) {
            videoUrl = data.result.download.hd;
            quality = 'HD';
        } else if (data.result?.download?.sd?.startsWith('http')) {
            videoUrl = data.result.download.sd;
            quality = 'SD';
        }

        // Last chance fallback: any mp4 link in response
        if (!videoUrl) {
            const json = JSON.stringify(data);
            const match = json.match(/"(https?:\/\/[^"]+\.mp4[^"]*)"/i);
            if (match?.[1]) {
                videoUrl = match[1];
                quality = 'Extracted';
            }
        }

        const title = data.result?.title || 'Facebook Video';
        const caption = title ? `📝 \( {title} ( \){quality})` : `Facebook Video (${quality})`;

        if (!videoUrl) {
            return await sock.sendMessage(chatId, { 
                text: `❌ No video link found in API response.\n\nRaw API data (partial):\n${JSON.stringify(data, null, 2).slice(0, 400)}...` 
            }, { quoted: message });
        }

        // Try direct send first (fastest)
        try {
            await sock.sendMessage(chatId, { 
                video: { url: videoUrl },
                mimetype: 'video/mp4',
                caption,
                fileName: `fb_${quality}.mp4`
            }, { quoted: message });

            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
            return;
        } catch (e) {
            console.log('[FB] Direct send failed:', e.message);
        }

        // Fallback: download & send
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const tempFile = path.join(tmpDir, `fb_${Date.now()}.mp4`);

        const videoStream = await axios.get(videoUrl, {
            responseType: 'stream',
            timeout: 120000,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.facebook.com/' }
        });

        const writer = fs.createWriteStream(tempFile);
        videoStream.data.pipe(writer);

        await new Promise((res, rej) => {
            writer.on('finish', res);
            writer.on('error', rej);
        });

        if (!fs.existsSync(tempFile) || fs.statSync(tempFile).size < 5000) {
            fs.unlinkSync(tempFile).catch(() => {});
            throw new Error('Downloaded file is invalid');
        }

        await sock.sendMessage(chatId, { 
            video: fs.createReadStream(tempFile),
            mimetype: 'video/mp4',
            caption,
            fileName: `fb_${quality}.mp4`
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

        // Cleanup
        setTimeout(() => fs.unlinkSync(tempFile).catch(() => {}), 12000);

    } catch (err) {
        console.error('[FB Error]', err.message);

        let replyText = '❌ Failed to download Facebook video.';
        if (err.response?.data?.message) {
            replyText += `\n\nAPI says:\n${err.response.data.message}`;
        } else if (err.code === 'ECONNABORTED') {
            replyText += '\nRequest timed out.';
        } else if (err.response?.status === 429) {
            replyText += '\nRate limited — wait a few minutes.';
        }

        await sock.sendMessage(chatId, { 
            text: replyText + '\nTry another public link.' 
        }, { quoted: message });
    }
}

module.exports = facebookCommand;