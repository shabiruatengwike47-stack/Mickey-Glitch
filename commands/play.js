const yts = require('yt-search');
const axios = require('axios');
const { toAudio } = require('../lib/converter');

/**
 * Download audio via external API (NO ytdl, NO yt-dlp)
 */
async function downloadAudio(videoUrl) {
    const apiUrl = 'https://co.wuk.sh/api/json'; // Cobalt public endpoint

    const { data } = await axios.post(apiUrl, {
        url: videoUrl,
        vCodec: 'none',
        aFormat: 'mp3',
        isAudioOnly: true
    }, {
        timeout: 60000
    });

    if (!data || !data.url) {
        throw new Error('Failed to get download link');
    }

    const audioRes = await axios.get(data.url, {
        responseType: 'arraybuffer',
        timeout: 60000
    });

    return {
        buffer: Buffer.from(audioRes.data),
        ext: 'mp3'
    };
}

/**
 * SONG COMMAND
 */
async function songCommand(sock, chatId, message) {
    try {
        const text =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            '';

        if (!text.trim()) {
            return sock.sendMessage(
                chatId,
                { text: 'Usage: .song <song name or YouTube link>' },
                { quoted: message }
            );
        }

        let video;

        if (text.includes('youtube.com') || text.includes('youtu.be')) {
            video = {
                url: text.startsWith('http') ? text : `https://${text}`,
                title: 'YouTube Audio',
                thumbnail: ''
            };
        } else {
            const search = await yts(text);
            if (!search.videos.length) {
                return sock.sendMessage(
                    chatId,
                    { text: '❌ No results found.' },
                    { quoted: message }
                );
            }
            video = search.videos[0];
        }

        // Preview
        await sock.sendMessage(
            chatId,
            {
                image: video.thumbnail ? { url: video.thumbnail } : undefined,
                caption: `🎵 *${video.title}*\n\nDownloading audio…`
            },
            { quoted: message }
        );

        const { buffer } = await downloadAudio(video.url);

        if (!buffer || buffer.length < 30000) {
            throw new Error('Audio too small or empty');
        }

        const safeTitle = (video.title || 'audio')
            .replace(/[^a-z0-9 ]/gi, '_')
            .slice(0, 60);

        await sock.sendMessage(
            chatId,
            {
                audio: buffer,
                mimetype: 'audio/mpeg',
                fileName: `${safeTitle}.mp3`,
                ptt: false
            },
            { quoted: message }
        );

        console.log('[SONG] Sent:', video.title);

    } catch (err) {
        console.error('[SONG ERROR]', err);

        let msg = '❌ Failed to download song.';
        const e = (err.message || '').toLowerCase();

        if (e.includes('rate') || e.includes('blocked')) {
            msg = '❌ Download service busy. Try again later.';
        } else if (e.includes('timeout')) {
            msg = '❌ Connection timeout.';
        }

        await sock.sendMessage(chatId, { text: msg }, { quoted: message });
    }
}

module.exports = songCommand;