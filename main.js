
// --- Socket.IO and Room Setup ---
const socket = io();
const currentRoom = 'general';
socket.emit('join room', currentRoom);

// --- Video Call Functionality (WebRTC + Socket.IO signaling) ---
const videoCallBtn = document.getElementById('video-call-btn');
const videoCallModal = document.getElementById('video-call-modal');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const endCallBtn = document.getElementById('end-call-btn');
let localStream = null;
let peerConnection = null;
let isCalling = false;

const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

if (videoCallBtn && videoCallModal && localVideo && remoteVideo && endCallBtn) {
  videoCallBtn.addEventListener('click', async function() {
    videoCallModal.style.display = 'flex';
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
      startCall();
    } catch (err) {
      alert('Could not access camera/microphone: ' + err.message);
      videoCallModal.style.display = 'none';
    }
  });
  endCallBtn.addEventListener('click', function() {
    endCall();
  });
}

function startCall() {
  isCalling = true;
  peerConnection = new RTCPeerConnection(rtcConfig);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { candidate: event.candidate });
    }
  };
  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };
  peerConnection.onnegotiationneeded = async () => {
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('video-offer', { sdp: peerConnection.localDescription });
    } catch (err) {
      alert('Negotiation error: ' + err.message);
    }
  };
}

function endCall() {
  videoCallModal.style.display = 'none';
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localVideo.srcObject = null;
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
  isCalling = false;
}

// --- WebRTC signaling handlers ---
socket.on('video-offer', async (data) => {
  if (!isCalling) {
    videoCallModal.style.display = 'flex';
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
    } catch (err) {
      alert('Could not access camera/microphone: ' + err.message);
      videoCallModal.style.display = 'none';
      return;
    }
    isCalling = true;
  }
  peerConnection = new RTCPeerConnection(rtcConfig);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { candidate: event.candidate });
    }
  };
  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('video-answer', { sdp: peerConnection.localDescription });
});

socket.on('video-answer', async (data) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
  }
});

socket.on('ice-candidate', async (data) => {
  if (peerConnection && data.candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (err) {
      console.error('Error adding received ice candidate', err);
    }
  }
});
// Media file sharing logic
const mediaBtn = document.getElementById('media-btn');
const mediaInput = document.getElementById('media-input');
if (mediaBtn && mediaInput) {
  mediaBtn.addEventListener('click', () => mediaInput.click());
  mediaInput.addEventListener('change', function() {
    const file = mediaInput.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const user = getUserInfo();
        const now = new Date();
        const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        socket.emit('chat message', {
          image: e.target.result,
          username: user.username,
          avatar: user.avatar,
          room: currentRoom,
          time: time
        });
      };
      reader.readAsDataURL(file);
    }
    mediaInput.value = '';
  });
}


const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const usernameInput = document.getElementById('username');

// --- Authentication using localStorage ---
function setUsername(username) {
  localStorage.setItem('chatbox_username', username);
  usernameInput.value = username;
  usernameInput.disabled = true;
}

function getUsername() {
  return localStorage.getItem('chatbox_username');
}

function promptForUsername() {
  let username = '';
  while (!username || username.length < 3) {
    username = prompt('Enter a username (3-16 chars):', '');
    if (username === null) break;
    username = username.trim().slice(0, 16);
    if (username.length < 3) username = '';
  }
  if (username) setUsername(username);
}

window.addEventListener('DOMContentLoaded', () => {
  let saved = getUsername();
  if (saved) {
    setUsername(saved);
  } else {
    promptForUsername();
  }
});

usernameInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = usernameInput.value.trim().slice(0, 16);
    if (val.length >= 3) {
      setUsername(val);
    }
  }
});

function getUserInfo() {
  let username = getUsername() || usernameInput.value.trim() || 'Anonymous';
  let firstName = username.split(' ')[0] || 'User';
  let avatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(firstName);
  return { username, avatar };
}

form.addEventListener('submit', function(e) {
  e.preventDefault();
  if (input.value) {
    const user = getUserInfo();
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    socket.emit('chat message', {
      text: input.value,
      username: user.username,
      avatar: user.avatar,
      room: currentRoom,
      time: time
    });
    input.value = '';
  }
});

function appendMessage(msg) {
  const item = document.createElement('li');
  const avatarImg = document.createElement('img');
  avatarImg.src = msg.avatar;
  avatarImg.alt = 'avatar';
  avatarImg.className = 'avatar';
  const usernameSpan = document.createElement('span');
  usernameSpan.className = 'username';
  usernameSpan.textContent = msg.username + ': ';
  item.appendChild(avatarImg);
  item.appendChild(usernameSpan);
  if (msg.image) {
    const img = document.createElement('img');
    img.src = msg.image;
    img.alt = 'shared image';
    img.style.maxWidth = '180px';
    img.style.maxHeight = '120px';
    img.style.display = 'block';
    img.style.margin = '6px 0';
    img.style.cursor = 'pointer';
    img.title = 'Click to save image';
    img.addEventListener('click', function() {
      const a = document.createElement('a');
      a.href = img.src;
      a.download = 'chat-image.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
    item.appendChild(img);
  }
  if (msg.text) {
    const textSpan = document.createElement('span');
    textSpan.textContent = msg.text;
    item.appendChild(textSpan);
  }
  if (msg.time) {
    const timeSpan = document.createElement('span');
    timeSpan.className = 'timestamp';
    timeSpan.textContent = msg.time;
    item.appendChild(timeSpan);
  }
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}
// Focus input on page load for better UX
window.onload = function() {
  input.focus();
};

socket.on('chat message', function(msg) {
  // Only show messages for the current room
  if (msg.room === currentRoom) {
    appendMessage(msg);
  }
});

socket.on('message history', function(msgs) {
  messages.innerHTML = '';
  msgs.forEach(appendMessage);
});

