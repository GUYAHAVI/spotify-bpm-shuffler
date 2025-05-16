require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const SpotifyWebApi = require('spotify-web-api-node');

const app = express();
app.use(cors());
app.use(express.json());

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// Authentication endpoint
app.post('/login', (req, res) => {
  const code = req.body.code;
  
  spotifyApi.authorizationCodeGrant(code).then(data => {
    res.json({
      accessToken: data.body.access_token,
      refreshToken: data.body.refresh_token,
      expiresIn: data.body.expires_in
    });
  }).catch(err => {
    res.status(400).json({ error: 'Failed to authenticate' });
  });
});

// Refresh token endpoint
app.post('/refresh', (req, res) => {
  const refreshToken = req.body.refreshToken;
  spotifyApi.setRefreshToken(refreshToken);
  
  spotifyApi.refreshAccessToken().then(data => {
    res.json({
      accessToken: data.body.access_token,
      expiresIn: data.body.expires_in
    });
  }).catch(err => {
    res.status(400).json({ error: 'Failed to refresh token' });
  });
});

// BPM shuffle endpoint
app.post('/shuffle', async (req, res) => {
  const { accessToken, playlistId, startingBPM, bpmRange } = req.body;
  spotifyApi.setAccessToken(accessToken);
  
  try {
    // Get playlist tracks
    const playlist = await spotifyApi.getPlaylistTracks(playlistId);
    const tracks = playlist.body.items;
    
    // Get audio features for each track
    const trackIds = tracks.map(track => track.track.id);
    const audioFeatures = await spotifyApi.getAudioFeaturesForTracks(trackIds);
    
    // Combine tracks with their BPM data
    const tracksWithBPM = tracks.map((track, i) => ({
      ...track,
      bpm: audioFeatures.body.audio_features[i]?.tempo || 0
    }));
    
    // Apply your BPM shuffle algorithm
    const shuffledTracks = bpmShuffle(tracksWithBPM, startingBPM, bpmRange);
    
    res.json(shuffledTracks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to shuffle playlist' });
  }
});

// Your BPM shuffle algorithm (adapted)
function bpmShuffle(tracks, startingBPM, bpmRange = 10) {
  // Filter tracks within BPM range
  const validTracks = tracks.filter(track => 
    Math.abs(track.bpm - startingBPM) <= bpmRange
  );
  
  // Separate the starting track if it exists
  const startingTrack = validTracks.find(track => track.bpm === startingBPM);
  const otherTracks = validTracks.filter(track => track.bpm !== startingBPM);
  
  // Shuffle the remaining tracks
  for (let i = otherTracks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
  }
  
  // Combine starting track with shuffled tracks
  return startingTrack ? [startingTrack, ...otherTracks] : otherTracks;
}
// Callback endpoint for Spotify authorization
app.get('/callback', (req, res) => {
  const code = req.query.code;
  if (code) {
    // Process the authorization code
    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'spotify-auth-code', code: '${code}' }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  } else {
    res.status(400).send('Authorization failed: No code received');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));