// server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

// Store room users
const rooms: { [roomId: string]: string[] } = {};

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 🔹 JOIN ROOM
    socket.on('join-room', ({ roomId }) => {
      console.log(`User ${socket.id} joining room ${roomId}`);

      socket.join(roomId);

      // Create room if not exists
      if (!rooms[roomId]) {
        rooms[roomId] = [];
      }

      // Send existing users to new user
      socket.emit('existing-users', rooms[roomId]);

      // Add new user
      rooms[roomId].push(socket.id);

      // Notify others in room
      socket.to(roomId).emit('user-joined', socket.id);
    });

    // 🔹 SIGNALING: OFFER
    socket.on('offer', ({ to, offer }) => {
      io.to(to).emit('offer', {
        from: socket.id,
        offer,
      });
    });

    // 🔹 SIGNALING: ANSWER
    socket.on('answer', ({ to, answer }) => {
      io.to(to).emit('answer', {
        from: socket.id,
        answer,
      });
    });

    // 🔹 SIGNALING: ICE CANDIDATE
    socket.on('ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('ice-candidate', {
        from: socket.id,
        candidate,
      });
    });

    // 🔹 CHAT MESSAGE
    socket.on('chat-message', ({ roomId, message }) => {
      socket.to(roomId).emit('chat-message', {
        from: socket.id,
        message,
      });
    });

    // 🔹 DISCONNECT
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      for (const roomId in rooms) {
        if (rooms[roomId].includes(socket.id)) {
          // Remove user from room
          rooms[roomId] = rooms[roomId].filter(
            (id) => id !== socket.id
          );

          // Notify others
          socket.to(roomId).emit('user-disconnected', socket.id);
        }
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});