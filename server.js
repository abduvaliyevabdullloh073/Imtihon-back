const express = require('express');
const fileUpload = require('express-fileupload');
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

// SOCKET IO sozlamalari (CORS bilan to‘g‘ri)
const io = socketIo(server, {
  cors: {
    origin: 'https://bobur-social-app.netlify.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  },
});

// Global Socket holat
global._io = io;
const onlineUsers = new Map();
global.onlineUsers = onlineUsers;

// Middlewares
app.use(fileUpload({ useTempFiles: true, tempFileDir: '/tmp/' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS sozlamasi (Netlify frontend uchun)
app.use(cors({
  origin: 'https://bobur-social-app.netlify.app',
  credentials: true,
}));

// Statik fayllar uchun (agar kerak bo‘lsa, yo‘q bo‘lsa, o‘chirib qo‘y)
app.use(express.static(path.join(__dirname, 'public')));

// ROUTERLAR
app.use('/api', authRouter);
app.use('/api/user', userRouter);
app.use('/api/admin', adminRouter);
app.use('/api/post', postRouter);
app.use('/api/comment', commentRouter);
app.use('/api/notifications', notificationRouter);

// SOCKET IO Hodisalari
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join', (userId) => {
    if (userId) {
      socket.join(userId.toString());
      onlineUsers.set(userId.toString(), socket.id);
      console.log(`User ${userId} joined`);
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
    console.log('Client disconnected:', socket.id);
  });
});

// MongoDB ulanishi va serverni ishga tushurish
const MONGO_URL = process.env.MONGO_URL;
const PORT = process.env.PORT || 4000;

mongoose
  .connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    server.listen(PORT, () => {
      console.log(`✅ Server is running on port: ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  });

// UNIVERSAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Serverda xato yuz berdi' });
});
