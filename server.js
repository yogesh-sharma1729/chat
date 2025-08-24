
// Entry point for the chat app server
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// In-memory message store (resets on server restart)
const messageHistory = {};

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  // --- WebRTC signaling events ---
  socket.on('video-offer', (data) => {
    // data: { sdp, from }
    socket.broadcast.emit('video-offer', data);
  });
  socket.on('video-answer', (data) => {
    // data: { sdp, from }
    socket.broadcast.emit('video-answer', data);
  });
  socket.on('ice-candidate', (data) => {
    // data: { candidate, from }
    socket.broadcast.emit('ice-candidate', data);
  });
  console.log('A user connected');
  const room = 'general';
  socket.join(room);

  // Send last 50 messages for the general room
  socket.emit('message history', messageHistory[room] || []);

  socket.on('join room', () => {
    // No-op, always in general
    socket.emit('message history', messageHistory[room] || []);
  });

  socket.on('chat message', (msg) => {
    // msg can be: { text?, image?, username, avatar, room }
    if (
      typeof msg === 'object' &&
      msg.username &&
      msg.avatar &&
      msg.room &&
      (msg.text || msg.image)
    ) {
      // Save to in-memory history
      if (!messageHistory[room]) messageHistory[room] = [];
      messageHistory[room].push(msg);
      // Limit to last 50 messages
      if (messageHistory[room].length > 50) messageHistory[room] = messageHistory[room].slice(-50);
      io.to(room).emit('chat message', msg);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
