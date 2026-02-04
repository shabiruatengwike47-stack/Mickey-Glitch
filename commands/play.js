const axios = require('axios');
const yts = require('yt-search');
const { getBuffer } = require("../lib/myfunc");

const AXIOS_CONFIG = {
    timeout: 45000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br'
    },
    maxContentLength: 50 * 1024 * 1024,     // ~50MB
    maxBodyLength: 50 * 1024 * 1024
};

const MP3_DOWNLOAD_APIS = [
    url => `https://apis-malvin.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`,
    url => `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(url)}`,
    url => `https://apis.davidcyriltech.my.id/youtube/mp3?url=${encodeURIComponent(url)}`,
    url => `https://jawad-tech.vercel.app/download/ytmp3?url=${encodeURIComponent(url)}`,
    url => `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(url)}&format=mp3`,
    url => `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`
];

async function tryFetchWithTimeout(fetchFn, timeoutMs = 40000) {
    return Promise.race([
        fetchFn(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
        )
    ]);
}

async function tryGetAudioLink(videoUrl, titleForQuery = '') {
    const errors = [];

    for (const apiFn of MP3_DOWNLOAD_APIS) {
        const apiUrl = apiFn(videoUrl);

        try {
            const res = await tryFetchWithTimeout(() =>
                axios.get(apiUrl, AXIOS_CONFIG)
            );

            const data = res.data;

            // ────────────────────────────────────────────────
            // Different APIs → different response structures
            // ────────────────────────────────────────────────
            let downloadUrl;

            if (data?.result?.download) {
                downloadUrl = data.result.download;
            } else if (data?.dl || data?.download) {
                downloadUrl = data.dl || data.download;
            } else if (data?.url) {
                downloadUrl = data.url;
            } else if (data?.link) {
                downloadUrl = data.link;
            } else if (data?.audio?.url) {
                downloadUrl = data.audio.url;
            }

            if (downloadUrl && typeof downloadUrl === 'string' && downloadUrl.startsWith('http')) {
                return {
                    downloadUrl,
                    title: data.title || data.song || titleForQuery || 'Audio',
                    thumbnail: data.thumb || data.thumbnail || null
                };
            }

        } catch (err) {
            errors.push({
                api: apiUrl.split('?')[0],
                error: err.message || err.toString()
            });
        }

        // small delay between attempts to avoid rate-limit / IP block
        await new Promise(r => setTimeout(r, 800));
    }

    throw new Error(`All ${MP3_DOWNLOAD_APIS.length} APIs failed.\nLast error: ${errors[errors.length-1]?.error || 'Unknown'}`);
}

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = text.split(' ').slice(1).join(' ').trim();

        if (!query) {
            await sock.sendMessage(chatId, { text: '⚠️ Usage: .play <song name or YouTube link>' }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            react: { text: "🔍", key: message.key }
        });

        let videoInfo;

        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            videoInfo = {
                url: query,
                title: 'YouTube Link',
                thumbnail: 'https://i.ytimg.com/vi_webp/default.jpg', // placeholder
                timestamp: '?'
            };
        } else {
            await sock.sendMessage(chatId, {
                react: { text: "🔎", key: message.key }
            });

            const search = await yts(query);
            if (!search.videos?.length) {
                await sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
                await sock.sendMessage(chatId, { react: { text: "❌", key: message.key } });
                return;
            }

            videoInfo = search.videos[0];
        }

        await sock.sendMessage(chatId, {
            react: { text: "⬇️", key: message.key }
        });

        // Try to get thumbnail
        let thumbnailBuffer;
        try {
            thumbnailBuffer = await getBuffer(videoInfo.thumbnail);
        } catch {
            thumbnailBuffer = await getBuffer("https://i.ytimg.com/vi_webp/default.jpg");
        }

        // Beautiful preview
        await sock.sendMessage(chatId, {
            text: "🎵 *Preparing your song...*",
            contextInfo: {
                externalAdReply: {
                    title: videoInfo.title || "Unknown Title",
                    body: `Duration: ${videoInfo.timestamp || '?'} • Requested by Mickey Glitch™`,
                    thumbnail: thumbnailBuffer,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    sourceUrl: videoInfo.url || "https://youtube.com"
                }
            }
        }, { quoted: message });

        // ─── Main download logic ────────────────────────────────
        const audioInfo = await tryGetAudioLink(videoInfo.url, videoInfo.title);

        if (!audioInfo?.downloadUrl) {
            throw new Error("Could not find any working download link");
        }

        await sock.sendMessage(chatId, {
            react: { text: "🎵", key: message.key }
        });

        // Send audio
        await sock.sendMessage(chatId, {
            audio: { url: audioInfo.downloadUrl },
            mimetype: 'audio/mpeg',
            fileName: `${(audioInfo.title || videoInfo.title || 'song').replace(/[^\w\s-]/g, '')}.mp3`,
            ptt: false,
            waveform: [5,18,35,55,78,95,82,60,38,20,8,0] // nicer looking waveform
        }, { quoted: message });

        await sock.sendMessage(chatId, {
            react: { text: "✅", key: message.key }
        });

    } catch (err) {
        console.error('[PLAY ERROR]', err);

        let errorText = '❌ Failed to download the song.\nTry again later or use another song.';

        if (err.message.includes('All') && err.message.includes('failed')) {
            errorText = '❌ All download servers are currently down or blocked.\nPlease try again in a few minutes.';
        }

        await sock.sendMessage(chatId, { text: errorText }, { quoted: message });
        await sock.sendMessage(chatId, {
            react: { text: "❌", key: message.key }
        });
    }
}

module.exports = playCommand;