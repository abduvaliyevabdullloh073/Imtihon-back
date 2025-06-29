const express = require('express');
const expressFileUpload = require('express-fileupload');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

// Routerlar
const authRouter = require('./src/Router/authRouter');
const adminRouter = require('./src/Router/adminRouter');
const postRouter = require('./src/Router/postRouter');
const userRouter = require('./src/Router/userRouter');
const commentRouter = require('./src/Router/commentRouter');
const notificationRouter = require('./src/Router/notlificationRouter');

const app = express();
const server = http.createServer(app);

// CORS uchun frontend URL (Netlify domeni)
const FRONTEND_URL = 'https://shimmering-tanuki-4438d1.netlify.app';

// CORS sozlamasi (asosiy)
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));

// Fayl upload va JSON parser
app.use(expressFileUpload({ useTempFiles: true, tempFileDir: '/tmp/' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Statik fayllar
app.use(express.static(path.join(__dirname, 'public')));

// ROUTERLAR
app.use('/api', authRouter);
app.use('/api/user', userRouter);
app.use('/api/admin', adminRouter);
app.use('/api/post', postRouter);
app.use('/api/comment', commentRouter);
app.use('/api/notifications', notificationRouter);

// SOCKET.IO CORS bilan
const io = socketIo(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Socket global
global._io = io;
const onlineUsers = new Map();
global.onlineUsers = onlineUsers;

// SOCKET IO
io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    if (userId) {
      socket.join(userId.toString());
      onlineUsers.set(userId.toString(), socket.id);
    }
  });
  socket.on('notificationRead', ({ notificationId, userId }) => {
    io.to(userId.toString()).emit('notificationUpdated', {
      notificationId,
      isRead: true,
    });
  });
  socket.on('disconnect', () => {
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
  });
});

// MONGO
const MONGO_URL = process.env.MONGO_URL;
const PORT = process.env.PORT || 4000;

mongoose
  .connect(MONGO_URL)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`✅ Server ishga tushdi: ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB xatolik:', error.message);
    process.exit(1);
  });

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Serverda xatolik yuz berdi' });
});
