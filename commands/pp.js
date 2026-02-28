const setProfilePicture = require('./setpp');

module.exports = async function ppCommand(sock, chatId, msg) {
  // Delegate to existing setpp logic (already checks owner permissions)
  try {
    await setProfilePicture(sock, chatId, msg);
  } catch (e) {
    console.error('Error in .pp command:', e);
    try { await sock.sendMessage(chatId, { text: '❌ Failed to update profile picture.' }); } catch (er) {}
  }
};
