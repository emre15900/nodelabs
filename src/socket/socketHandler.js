import { authenticateSocket } from '../middleware/auth.js';
import { addOnlineUser, removeOnlineUser } from '../config/redis.js';
import logger from '../utils/logger.js';

let io;

export const initializeSocket = (socketIO) => {
  io = socketIO;

  // Authentication middleware
  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    const user = socket.user;

    logger.info(`User connected: ${user.username} (${userId})`);

    try {
      // Add user to online users list
      await addOnlineUser(userId);

      // Join user to their personal room
      socket.join(`user_${userId}`);

      // Broadcast user online status
      socket.broadcast.emit('user_online', {
        userId,
        username: user.username,
        timestamp: new Date()
      });

      // Handle joining conversation rooms
      socket.on('join_room', (data) => {
        const { conversationId } = data;
        if (conversationId) {
          socket.join(`conversation_${conversationId}`);
          logger.debug(`User ${userId} joined conversation ${conversationId}`);
        }
      });

      // Handle leaving conversation rooms
      socket.on('leave_room', (data) => {
        const { conversationId } = data;
        if (conversationId) {
          socket.leave(`conversation_${conversationId}`);
          logger.debug(`User ${userId} left conversation ${conversationId}`);
        }
      });

      // Handle real-time message sending
      socket.on('send_message', async (data) => {
        try {
          const { conversationId, content, receiverId } = data;

          // Validate required fields
          if (!conversationId || !content || !receiverId) {
            socket.emit('error', {
              message: 'Missing required fields: conversationId, content, receiverId'
            });
            return;
          }

          // Emit to conversation room
          socket.to(`conversation_${conversationId}`).emit('message_received', {
            senderId: userId,
            senderUsername: user.username,
            content,
            conversationId,
            timestamp: new Date()
          });

          // Also emit directly to receiver's personal room
          socket.to(`user_${receiverId}`).emit('new_message_notification', {
            senderId: userId,
            senderUsername: user.username,
            conversationId,
            preview: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
            timestamp: new Date()
          });

          logger.debug(`Real-time message sent from ${userId} to ${receiverId} in conversation ${conversationId}`);

        } catch (error) {
          logger.error('Socket send_message error:', error);
          socket.emit('error', {
            message: 'Failed to send message'
          });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        const { conversationId, receiverId } = data;
        if (conversationId && receiverId) {
          socket.to(`user_${receiverId}`).emit('user_typing', {
            userId,
            username: user.username,
            conversationId,
            isTyping: true
          });
        }
      });

      socket.on('typing_stop', (data) => {
        const { conversationId, receiverId } = data;
        if (conversationId && receiverId) {
          socket.to(`user_${receiverId}`).emit('user_typing', {
            userId,
            username: user.username,
            conversationId,
            isTyping: false
          });
        }
      });

      // Handle message read receipts
      socket.on('message_read', (data) => {
        const { messageId, senderId } = data;
        if (messageId && senderId) {
          socket.to(`user_${senderId}`).emit('message_read_receipt', {
            messageId,
            readBy: userId,
            readAt: new Date()
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', async () => {
        try {
          // Remove user from online users list
          await removeOnlineUser(userId);

          // Broadcast user offline status
          socket.broadcast.emit('user_offline', {
            userId,
            username: user.username,
            timestamp: new Date()
          });

          logger.info(`User disconnected: ${user.username} (${userId})`);

        } catch (error) {
          logger.error('Socket disconnect error:', error);
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error for user ${userId}:`, error);
      });

    } catch (error) {
      logger.error('Socket connection setup error:', error);
      socket.disconnect();
    }
  });

  // Handle connection errors
  io.on('connect_error', (error) => {
    logger.error('Socket.IO connection error:', error);
  });

  logger.info('Socket.IO initialized successfully');
};

export const getSocketIO = () => {
  return io;
};

// Utility functions for emitting events from other parts of the application
export const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

export const emitToConversation = (conversationId, event, data) => {
  if (io) {
    io.to(`conversation_${conversationId}`).emit(event, data);
  }
};

export const broadcastToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};