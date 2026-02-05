const axios = require('axios');
const yts = require('yt-search');

/**
 * SONG COMMAND - Rahisi na Yenye Ufanisi
 */
async function songCommand(sock, chatId, message) {
  // 1. Pata maneno yaliyoandikwa baada ya command
  const textBody = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
  const query = textBody.split(" ").slice(1).join(" ");

  if (!query) {
    return sock.sendMessage(chatId, { text: '❌ Tafadhali andika jina la wimbo!' }, { quoted: message });
  }

  try {
    // 2. Search Video YouTube
    const search = await yts(query);
    const video = search.videos[0];

    if (!video) {
      return sock.sendMessage(chatId, { text: '❌ Wimbo haujapatikana!' }, { quoted: message });
    }

    const videoUrl = video.url;
    
    // 3. React kuonyesha kazi imeanza
    await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

    // 4. Download kutoka kwenye API yako
    const apiEndpoint = `https://api-aswin-sparky.koyeb.app/api/downloader/song?search=${encodeURIComponent(videoUrl)}`;
    const response = await axios.get(apiEndpoint);

    // Kwenye API hii, link ya kudownload mara nyingi ipo kwenye: data.result.download_url
    const downloadUrl = response.data?.result?.download_url || response.data?.data?.download || response.data?.url;

    if (!downloadUrl) {
      throw new Error('API imeshindwa kutoa link ya wimbo.');
    }

    // 5. Tuma Audio kwa mtumiaji
    await sock.sendMessage(
      chatId,
      {
        audio: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${video.title}.mp3`,
        contextInfo: {
          externalAdReply: {
            title: video.title,
            body: `Muda: ${video.timestamp}`,
            thumbnailUrl: video.thumbnail,
            sourceUrl: videoUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      },
      { quoted: message }
    );

    // 6. Maliza kwa kuweka tiki
    await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

  } catch (err) {
    console.error('ERROR:', err);
    await sock.sendMessage(chatId, { text: '❌ Hitilafu imetokea! Jaribu tena baadae.' }, { quoted: message });
  }
}

module.exports = songCommand;
