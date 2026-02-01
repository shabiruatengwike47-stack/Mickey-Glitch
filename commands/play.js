import axios from 'axios';
import config from '../config.js';

const OWNER_NAME = (config && config.OWNER_NAME) || process.env.OWNER_NAME || 'Mickey';
const API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyDV11sdmCCdyyToNU-XRFMbKgAA4IEDOS0';
const FASTAPI_URL = process.env.FASTAPI_URL || 'https://api.danscot.dev/api';

export async function play(message, client) {
	const remoteJid = message.key.remoteJid;
	const messageBody = (message.message?.extendedTextMessage?.text || message.message?.conversation || '');

	try {
		const title = getArg(messageBody);

		if (!title) {
			await client.sendMessage(remoteJid, { text: '❌ Please provide a video title.' });
			return;
		}

		await client.sendMessage(remoteJid, {
			text: `> _*Searching and processing: ${title}*_`,
			quoted: message,
		});

		// Search YouTube via Data API v3
		const searchUrl = `https://www.googleapis.com/youtube/v3/search`;
		const { data: searchData } = await axios.get(searchUrl, {
			params: {
				part: 'snippet',
				q: title,
				type: 'video',
				maxResults: 1,
				key: API_KEY,
			},
			timeout: 20000,
		});

		if (!searchData?.items || searchData.items.length === 0) {
			throw new Error('No video found.');
		}

		const video = searchData.items[0];
		const videoId = video.id?.videoId || (video.id && video.id);
		const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
		const videoTitle = video.snippet.title;
		const thumbnail = video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url || null;

		// Call FastAPI downloader (only)
		const apiUrl = `${FASTAPI_URL}/youtube/downl/`;
		const { data } = await axios.get(apiUrl, {
			params: { url: videoUrl, fmt: 'mp3' },
			timeout: 60000
		});

		// Normalize possible response shapes
		let downloadUrl = null;
		if (data?.status === 'ok' && data?.results?.download_url) downloadUrl = data.results.download_url;
		else if (data?.results?.download) downloadUrl = data.results.download;
		else if (data?.download_url) downloadUrl = data.download_url;
		else if (data?.data?.download_url) downloadUrl = data.data.download_url;

		if (!downloadUrl) {
			throw new Error('Failed to get audio from FastAPI downloader.');
		}

		// Send thumbnail + info
		if (thumbnail) {
			await client.sendMessage(remoteJid, {
				image: { url: thumbnail },
				caption: `> 🎵 *${videoTitle}*\n\n> 🔗 ${videoUrl}\n\n> 📥 Downloading audio...\n\n> Powered By ${OWNER_NAME} Tech`,
				quoted: message,
			});
		} else {
			await client.sendMessage(remoteJid, { text: `🎵 ${videoTitle}\n🔗 ${videoUrl}\n📥 Downloading audio...\nPowered By ${OWNER_NAME} Tech`, quoted: message });
		}

		// Send audio directly via URL
		await client.sendMessage(remoteJid, {
			audio: { url: downloadUrl },
			mimetype: 'audio/mpeg',
			fileName: `${videoTitle}.mp3`,
			ptt: false,
			quoted: message,
		});

	} catch (err) {
		console.error('❌ Error in play command:', err?.message || err);
		try {
			await client.sendMessage(remoteJid, { text: `❌ Failed to play: ${err?.message || String(err)}` });
		} catch (e) {
			// ignore
		}
	}
}

function getArg(body) {
	const parts = body.trim().split(/\s+/);
	return parts.length > 1 ? parts.slice(1).join(' ') : null;
}

export default play;