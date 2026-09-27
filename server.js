const express = require('express');
const { WebcastPushConnection } = require('tiktok-live-connector');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

let tiktokLiveConnection = null;
let currentHost = "";
let spawnQueue = [];

// Endpoint to connect to TikTok LIVE
app.post('/connect-tiktok', (req, res) => {
  const username = req.body?.username;
  if (!username) {
    return res.status(400).json({ success: false, error: "Username required" });
  }

  const cleanUser = username.trim().replace('@', '');

  if (tiktokLiveConnection) {
    try {
      tiktokLiveConnection.disconnect();
    } catch (e) {}
  }

  currentHost = cleanUser;
  spawnQueue = [];

  tiktokLiveConnection = new WebcastPushConnection(cleanUser, {
    processInitialData: false,
    enableExtendedGiftInfo: false
  });

  tiktokLiveConnection.connect()
    .then(state => {
      console.log(`[✓] Connected to TikTok LIVE: @${cleanUser} (Room ID: ${state.roomId})`);
      res.json({ success: true, message: `Connected to @${cleanUser}` });
    })
    .catch(err => {
      console.error(`[X] Failed to connect:`, err.toString());
      res.status(500).json({ success: false, error: err.toString() });
    });

  // Collect chat comments
  tiktokLiveConnection.on('chat', data => {
    const comment = data.comment ? data.comment.trim() : "";
    // Filter to potential Roblox usernames (3-20 characters, alphanumeric + underscore)
    if (/^[a-zA-Z0-9_]{3,20}$/.test(comment)) {
      console.log(`[+] Queued user from @${cleanUser} chat: ${comment}`);
      spawnQueue.push(comment);
    }
  });

  tiktokLiveConnection.on('streamEnd', () => {
    console.log(`[!] Stream ended for @${cleanUser}`);
  });
});

// Endpoint for Roblox to poll comments
app.get('/get-spawns', (req, res) => {
  if (spawnQueue.length > 0) {
    const batch = [...spawnQueue];
    spawnQueue = [];
    return res.json({ users: batch });
  }
  res.json({ users: [] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Relay active on port ${PORT}`);
});