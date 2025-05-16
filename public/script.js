const clientId = '2e740f1fea254d798d5dec5d68f6f20a';
const redirectUri = 'https://127.0.0.1:3001/callback';
const scopes = ['user-read-private', 'user-read-email', 'playlist-read-private'];

let accessToken = null;
let userId = null;


document.getElementById('login-btn').addEventListener('click', () => {
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}&response_type=code`;
  window.location.href = authUrl;
});

// Handle callback after Spotify login
if (window.location.pathname === '/callback') {
  const code = new URLSearchParams(window.location.search).get('code');
  if (code) {
    authenticateUser(code);
  }
}

// Replace your current authenticateUser function with:
async function authenticateUser(code) {
  try {
    const response = await fetch('http://localhost:3001/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    
    const data = await response.json();
    if (data.accessToken) {
      accessToken = data.accessToken;
      document.getElementById('login-section').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      const playlists = await getUserPlaylists();
      populatePlaylistSelect(playlists);
    }
  } catch (error) {
    console.error('Authentication failed:', error);
    alert('Login failed. Please try again.');
  }
}

// Add this to handle the popup message
window.addEventListener('message', (event) => {
  if (event.data.type === 'spotify-auth-code') {
    authenticateUser(event.data.code);
  }
});

async function getUserPlaylists() {
  try {
    const response = await fetch('https://api.spotify.com/v1/me/playlists', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to get playlists:', error);
    return [];
  }
}

function populatePlaylistSelect(playlists) {
  const select = document.getElementById('playlist-select');
  playlists.items.forEach(playlist => {
    const option = document.createElement('option');
    option.value = playlist.id;
    option.textContent = playlist.name;
    select.appendChild(option);
  });
}

document.getElementById('shuffle-btn').addEventListener('click', async () => {
  const playlistId = document.getElementById('playlist-select').value;
  const startingBPM = parseInt(document.getElementById('starting-bpm').value);
  const bpmRange = parseInt(document.getElementById('bpm-range').value);
  
  if (!playlistId || !startingBPM) {
    alert('Please select a playlist and enter a starting BPM');
    return;
  }
  
  try {
    const response = await fetch('http://localhost:3001/shuffle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, playlistId, startingBPM, bpmRange })
    });
    
    const shuffledTracks = await response.json();
    displayPlaylist(shuffledTracks);
  } catch (error) {
    console.error('Shuffling failed:', error);
  }
});

function displayPlaylist(tracks) {
  const playlistDiv = document.getElementById('playlist');
  playlistDiv.innerHTML = '';
  
  tracks.forEach(track => {
    const trackDiv = document.createElement('div');
    trackDiv.className = 'track';
    
    trackDiv.innerHTML = `
      <img src="${track.track.album.images[0]?.url || ''}" alt="Album cover">
      <div class="track-info">
        <strong>${track.track.name}</strong><br>
        ${track.track.artists.map(artist => artist.name).join(', ')}
      </div>
      <div class="track-bpm">${Math.round(track.bpm)} BPM</div>
    `;
    
    playlistDiv.appendChild(trackDiv);
  });
}