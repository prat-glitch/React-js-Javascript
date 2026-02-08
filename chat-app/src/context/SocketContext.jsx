// src/context/SocketContext.jsx
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Appcontext } from './Appcontext';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { userdata } = useContext(Appcontext);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({}); // { chatId: Set of userIds }
  const typingTimeoutRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    if (!userdata?.uid) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const newSocket = io(SOCKET_SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      // Emit user online event
      newSocket.emit('user:online', userdata.uid);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    // Listen for user status changes
    newSocket.on('user:status', ({ userId, online }) => {
      console.log('User status update:', userId, online);
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        if (online) {
          updated.add(userId);
        } else {
          updated.delete(userId);
        }
        return updated;
      });
    });

    // Receive current online users list on connect
    newSocket.on('users:online-list', (userIds) => {
      console.log('Online users list received:', userIds);
      setOnlineUsers(new Set(userIds));
    });

    // Listen for typing updates
    newSocket.on('typing:update', ({ chatId, userId, isTyping }) => {
      setTypingUsers((prev) => {
        const chatTyping = new Set(prev[chatId] || []);
        if (isTyping) {
          chatTyping.add(userId);
        } else {
          chatTyping.delete(userId);
        }
        return { ...prev, [chatId]: chatTyping };
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [userdata?.uid]);

  // Join a chat room
  const joinChat = useCallback(
    (chatId) => {
      if (socket && isConnected) {
        socket.emit('chat:join', chatId);
      }
    },
    [socket, isConnected]
  );

  // Leave a chat room
  const leaveChat = useCallback(
    (chatId) => {
      if (socket && isConnected) {
        socket.emit('chat:leave', chatId);
      }
    },
    [socket, isConnected]
  );

  // Send message via Socket.IO
  const sendMessage = useCallback(
    (chatId, recipientId, text, imageUrl = null) => {
      if (!socket || !isConnected || !userdata?.uid) {
        console.error('Socket not connected');
        return false;
      }

      socket.emit('message:send', {
        chatId,
        senderId: userdata.uid,
        recipientId,
        text,
        imageUrl,
      });

      return true;
    },
    [socket, isConnected, userdata?.uid]
  );

  // Start typing indicator
  const startTyping = useCallback(
    (chatId) => {
      if (socket && isConnected && userdata?.uid) {
        socket.emit('typing:start', { chatId, userId: userdata.uid });

        // Auto-stop typing after 3 seconds
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          socket.emit('typing:stop', { chatId, userId: userdata.uid });
        }, 3000);
      }
    },
    [socket, isConnected, userdata?.uid]
  );

  // Stop typing indicator
  const stopTyping = useCallback(
    (chatId) => {
      if (socket && isConnected && userdata?.uid) {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        socket.emit('typing:stop', { chatId, userId: userdata.uid });
      }
    },
    [socket, isConnected, userdata?.uid]
  );

  // Mark messages as read
  const markAsRead = useCallback(
    (chatId, messageTimestamp) => {
      if (socket && isConnected && userdata?.uid) {
        socket.emit('message:read', {
          chatId,
          userId: userdata.uid,
          messageTimestamp,
        });
      }
    },
    [socket, isConnected, userdata?.uid]
  );

  // Check if user is online
  const isUserOnline = useCallback(
    (userId) => {
      return onlineUsers.has(userId);
    },
    [onlineUsers]
  );

  // Get typing users for a chat
  const getTypingUsers = useCallback(
    (chatId) => {
      return Array.from(typingUsers[chatId] || []);
    },
    [typingUsers]
  );

  const value = {
    socket,
    isConnected,
    onlineUsers,
    joinChat,
    leaveChat,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    isUserOnline,
    getTypingUsers,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export default SocketContext;
