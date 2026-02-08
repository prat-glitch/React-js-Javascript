// server/index.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin (you'll need to download your service account key)
// From: Firebase Console > Project Settings > Service Accounts > Generate New Private Key
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'], // Vite dev server
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());

// Track online users: { odId: socketId }
const onlineUsers = new Map();
// Track user sockets: { odId: Set of socketIds }
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // User comes online
  socket.on('user:online', async (userId) => {
    if (!userId) return;

    // Store socket mapping
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
    onlineUsers.set(socket.id, userId);

    // Join user's personal room for direct messages
    socket.join(`user:${userId}`);

    // Send current online users list to the newly connected user
    const currentOnlineUsers = [...userSockets.keys()];
    socket.emit('users:online-list', currentOnlineUsers);

    // Update online status in Firestore
    try {
      await db.collection('users').doc(userId).update({
        online: true,
        lastseen: new Date().toLocaleString(),
      });
    } catch (error) {
      console.error('Error updating user status:', error);
    }

    // Broadcast online status to all
    io.emit('user:status', { userId, online: true });
    console.log(`User ${userId} is now online`);
  });

  // Join a chat room (for 1:1 or group chats)
  socket.on('chat:join', (chatId) => {
    socket.join(`chat:${chatId}`);
    console.log(`Socket ${socket.id} joined chat:${chatId}`);
  });

  // Leave a chat room
  socket.on('chat:leave', (chatId) => {
    socket.leave(`chat:${chatId}`);
    console.log(`Socket ${socket.id} left chat:${chatId}`);
  });

  // Send message - the main event
  socket.on('message:send', async (data) => {
    const { chatId, senderId, recipientId, text, imageUrl } = data;

    if (!chatId || !senderId || !text?.trim()) {
      socket.emit('error', { message: 'Invalid message data' });
      return;
    }

    try {
      const newMessage = {
        senderId,
        text: text.trim(),
        imageUrl: imageUrl || null,
        createdAt: Date.now(),
        readBy: [senderId],
      };

      // Save to Firestore
      const chatRef = db.collection('chats').doc(chatId);
      const chatSnap = await chatRef.get();

      if (chatSnap.exists) {
        await chatRef.update({
          messages: admin.firestore.FieldValue.arrayUnion(newMessage),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await chatRef.set({
          messages: [newMessage],
          participants: [senderId, recipientId],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Update userChats for both users
      await updateUserChats(senderId, recipientId, text, false);
      await updateUserChats(recipientId, senderId, text, true);

      // Emit to chat room (both sender and recipient if they're in the room)
      io.to(`chat:${chatId}`).emit('message:new', {
        chatId,
        message: newMessage,
      });

      // Also emit to recipient's personal room (in case they're not in the chat room)
      io.to(`user:${recipientId}`).emit('message:notification', {
        chatId,
        senderId,
        preview: text.length > 50 ? text.substring(0, 50) + '...' : text,
      });

      console.log(`Message sent in chat ${chatId}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicators
  socket.on('typing:start', ({ chatId, userId }) => {
    socket.to(`chat:${chatId}`).emit('typing:update', {
      chatId,
      userId,
      isTyping: true,
    });
  });

  socket.on('typing:stop', ({ chatId, userId }) => {
    socket.to(`chat:${chatId}`).emit('typing:update', {
      chatId,
      userId,
      isTyping: false,
    });
  });

  // Message read receipt
  socket.on('message:read', async ({ chatId, userId, messageTimestamp }) => {
    try {
      // Update read status in Firestore
      const chatRef = db.collection('chats').doc(chatId);
      const chatSnap = await chatRef.get();

      if (chatSnap.exists) {
        const messages = chatSnap.data().messages || [];
        const updatedMessages = messages.map((msg) => {
          if (msg.createdAt <= messageTimestamp && !msg.readBy?.includes(userId)) {
            return {
              ...msg,
              readBy: [...(msg.readBy || []), userId],
            };
          }
          return msg;
        });

        await chatRef.update({ messages: updatedMessages });
      }

      // Broadcast read receipt
      socket.to(`chat:${chatId}`).emit('message:read-receipt', {
        chatId,
        userId,
        messageTimestamp,
      });
    } catch (error) {
      console.error('Error updating read receipt:', error);
    }
  });

  // Disconnect handling
  socket.on('disconnect', async () => {
    const userId = onlineUsers.get(socket.id);

    if (userId) {
      onlineUsers.delete(socket.id);
      userSockets.get(userId)?.delete(socket.id);

      // Only set offline if no other sockets for this user
      if (!userSockets.get(userId)?.size) {
        userSockets.delete(userId);

        const lastSeenTime = new Date().toLocaleString();

        // Update Firestore
        try {
          await db.collection('users').doc(userId).update({
            online: false,
            lastseen: lastSeenTime,
          });
        } catch (error) {
          console.error('Error updating offline status:', error);
        }

        // Broadcast offline status with lastSeen
        io.emit('user:status', { userId, online: false, lastseen: lastSeenTime });
        console.log(`User ${userId} went offline`);
      }
    }

    console.log(`User disconnected: ${socket.id}`);
  });
});

// Helper function to update userChats
async function updateUserChats(ownerId, partnerId, lastMsg, isRecipient) {
  const userChatsRef = db.collection('userChats').doc(ownerId);
  const snap = await userChatsRef.get();

  if (snap.exists) {
    const data = snap.data();
    let chatdata = data.chatdata || [];

    const existingIndex = chatdata.findIndex((c) => c.odId === partnerId);

    if (existingIndex !== -1) {
      chatdata[existingIndex] = {
        ...chatdata[existingIndex],
        lastMessage: lastMsg,
        updatedAt: Date.now(),
        messageSeen: !isRecipient,
      };
    } else {
      chatdata.push({
        odId: partnerId,
        lastMessage: lastMsg,
        updatedAt: Date.now(),
        messageSeen: !isRecipient,
      });
    }

    // Sort by most recent
    chatdata.sort((a, b) => b.updatedAt - a.updatedAt);

    await userChatsRef.update({ chatdata });
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', connections: io.engine.clientsCount });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
