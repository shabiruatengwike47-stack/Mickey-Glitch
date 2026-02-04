const axios = require('axios');
const yts = require('yt-search');
const config = require('../config.js');

// Mpangilio wa Jina la Owner
const OWNER_NAME = (config && config.OWNER_NAME) || process.env.OWNER_NAME || 'Mickey';

/* ======================================================
   MULTI MP3 APIS (Zilizochujwa na Imara)
====================================================== */
const MP3_APIS = [
  url => `https://apis-malvin.vercel.app/download/dlmp3?url=${encodeURIComponent(url)}`,
  url => `https://apis.davidcyriltech.my.id/youtube/mp3?url=${encodeURIComponent(url)}`,
  url => `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(url)}`,
  url => `https://jawad-tech.vercel.app/download/ytmp3?url=${encodeURIComponent(url)}`
];

/**
 * SONG COMMAND FUNCTION
 */
async function songCommand(sock, chatId, message) {
  const textBody =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    '';

  try {
    const title = getArg(textBody);
    if (!title) {
      return sock.sendMessage(
        chatId, 
        { text: '❌ Tafadhali andika jina la wimbo unatafuta. \n\n*Mfano:* .song Calm Down' }, 
        { quoted: message }
      );
    }

    // Reaction: Inatafuta...
    try {
      await sock.sendMessage(chatId, { react: { text: '🔎', key: message.key } });
    } catch (e) {}

    /* ─────── YouTube Search (yt-search) ─────── */
    const searchResult = await yts(title);
    const video = searchResult.videos[0]; // Inachukua video ya kwanza (Best Match)

    if (!video) {
      return sock.sendMessage(
        chatId, 
        { text: '❌ Samahani, sikuweza kupata wimbo huo. Jaribu kuandika jina kwa usahihi.' }, 
        { quoted: message }
      );
    }

    const videoUrl = video.url;
    const videoTitle = video.title;
    const duration = video.timestamp;
    const views = video.views.toLocaleString();
    const thumbnail = video.thumbnail;

    // Tuma ujumbe wa taarifa ya video iliyopatikana
    await sock.sendMessage(
      chatId,
      {
        text: `🎵 *${videoTitle}*\n\n` +
              `⏱ *Muda:* ${duration}\n` +
              `👁 *Views:* ${views}\n` +
              `🔗 *Link:* ${videoUrl}\n\n` +
              `_Napakua audio, tafadhali subiri..._`,
        contextInfo: {
          externalAdReply: {
            title: videoTitle,
            body: `Requested by ${OWNER_NAME}`,
            thumbnailUrl: thumbnail,
            sourceUrl: videoUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      },
      { quoted: message }
    );

    /* ─────── Fast MP3 Fetching ─────── */
    const downloadUrl = await fetchMp3Fast(videoUrl);

    // Safisha jina la file lisiwe na alama zisizoruhusiwa
    const safeName = videoTitle.replace(/[\\/:*?"<>|]/g, '').slice(0, 80);

    /* ─────── Tuma Audio File ─────── */
    await sock.sendMessage(
      chatId,
      {
        audio: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${safeName}.mp3`,
        ptt: false // Badilisha kuwa true kama unataka itume kama Voice Note
      },
      { quoted: message }
    );

    // Reaction: Imekamilika
    try {
      await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
    } catch (e) {}

  } catch (err) {
    console.error('❌ ERROR KATIKA SONG COMMAND:', err);
    await sock.sendMessage(
      chatId,
      { text: '❌ Hitilafu imetokea wakati wa kupata audio. Jaribu tena baadae.' },
      { quoted: message }
    );
  }
}

/* ======================================================
   Kazi ya Kutafuta Download Link (Race Condition)
====================================================== */
async function fetchMp3Fast(videoUrl) {
  // Tunatuma maombi kwenye API zote kwa mpigo
  const requests = MP3_APIS.map(async (fn) => {
    try {
      const response = await axios.get(fn(videoUrl), { timeout: 20000 });
      const link = extractDownloadUrl(response.data);
      if (link && link.startsWith('http')) return link;
      return null;
    } catch (error) {
      return null;
    }
  });

  // Tunachukua link ya kwanza itakayopatikana
  const results = await Promise.all(requests);
  const finalLink = results.find(u => u !== null);

  if (!finalLink) throw new Error('Mifumo yote imeshindwa kutoa audio.');
  return finalLink;
}

/**
 * Extraction Logic ya aina mbalimbali za majibu (Responses)
 */
function extractDownloadUrl(data) {
  return (
    data?.result?.download_url || 
    data?.result?.url || 
    data?.data?.download || 
    data?.data?.url || 
    data?.download || 
    data?.url || 
    null
  );
}

/**
 * Pata neno lililoandikwa baada ya command
 */
function getArg(body) {
  const parts = body.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : null;
}

module.exports = songCommand;
