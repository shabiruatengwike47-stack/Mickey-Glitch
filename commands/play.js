const axios = require('axios');
const config = require('../config.js');

const OWNER_NAME = (config && config.OWNER_NAME) || process.env.OWNER_NAME || 'Mickey';
const API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyDV11sdmCCdyyToNU-XRFMbKgAA4IEDOS0';
const FASTAPI_URL = process.env.FASTAPI_URL || 'https://api.danscot.dev/api';

async function songCommand(sock, chatId, message) {
  const textBody = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
  try {
    const title = getArg(textBody);
    if (!title) {
      await sock.sendMessage(chatId, { text: '❌ Please provide a video title.' }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, { text: `> _*Searching and processing: ${title}*_` }, { quoted: message });

    // Search YouTube
    const searchUrl = 'https://www.googleapis.com/youtube/v3/search';
    const { data: searchData } = await axios.get(searchUrl, {
      params: { part: 'snippet', q: title, type: 'video', maxResults: 1, key: API_KEY },
      timeout: 20000
    });

    if (!searchData?.items || searchData.items.length === 0) {
      throw new Error('No video found.');
    }

    const video = searchData.items[0];
    const videoId = video.id?.videoId || (video.id && video.id);
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const videoTitle = video.snippet.title;
    const thumbnail = video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url || null;

    // Call FastAPI downloader only
    const apiUrl = `${FASTAPI_URL}/youtube/downl/`;
    const { data } = await axios.get(apiUrl, { params: { url: videoUrl, fmt: 'mp3' }, timeout: 60000 });

    let downloadUrl = null;
    if (data?.status === 'ok' && data?.results?.download_url) downloadUrl = data.results.download_url;
    else if (data?.results?.download) downloadUrl = data.results.download;
    else if (data?.download_url) downloadUrl = data.download_url;
    else if (data?.data?.download_url) downloadUrl = data.data.download_url;

    if (!downloadUrl) throw new Error('Failed to get audio from FastAPI downloader.');

    // Send thumbnail/info
    if (thumbnail) {
      await sock.sendMessage(chatId, {
        image: { url: thumbnail },
        caption: `> 🎵 *${videoTitle}*\n\n> 🔗 ${videoUrl}\n\n> 📥 Downloading audio...\n\n> Powered By ${OWNER_NAME} Tech`,
      }, { quoted: message });
    } else {
      await sock.sendMessage(chatId, { text: `🎵 ${videoTitle}\n🔗 ${videoUrl}\n📥 Downloading audio...\nPowered By ${OWNER_NAME} Tech` }, { quoted: message });
    }

    // Send audio via URL
    await sock.sendMessage(chatId, {
      audio: { url: downloadUrl },
      mimetype: 'audio/mpeg',
      fileName: `${videoTitle}.mp3`,
      ptt: false
    }, { quoted: message });

  } catch (err) {
    console.error('❌ Error in play command:', err?.message || err);
    try { await sock.sendMessage(chatId, { text: `❌ Failed to play: ${err?.message || String(err)}` }, { quoted: message }); } catch (e) { }
  }
}

function getArg(body) {
  const parts = body.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : null;
}

module.exports = songCommand;