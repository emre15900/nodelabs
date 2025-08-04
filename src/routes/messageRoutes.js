import express from 'express';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateSendMessage, validateMessageId } from '../middleware/validation.js';
import { getSocketIO } from '../socket/socketHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/messages/send:
 *   post:
 *     summary: Send a message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiverId
 *               - content
 *             properties:
 *               receiverId:
 *                 type: string
 *                 description: ID of the message receiver
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Message content
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Receiver not found
 */
router.post('/send', authenticateToken, validateSendMessage, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const senderId = req.user._id;

    // Check if receiver exists and is active
    const receiver = await User.findOne({ 
      _id: receiverId, 
      isActive: true 
    });

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }

    // Can't send message to yourself
    if (senderId.toString() === receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send message to yourself'
      });
    }

    // Find or create conversation
    const conversation = await Conversation.findOrCreateConversation(senderId, receiverId);

    // Create message
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      conversation: conversation._id,
      content,
      messageType: 'text'
    });

    await message.save();

    // Update conversation last activity
    await conversation.updateLastActivity(message._id);

    // Populate message for response
    await message.populate([
      { path: 'sender', select: 'username' },
      { path: 'receiver', select: 'username' }
    ]);

    // Emit real-time event to receiver
    const io = getSocketIO();
    if (io) {
      io.to(`user_${receiverId}`).emit('message_received', {
        message: message.toJSON(),
        conversation: conversation.toJSON()
      });

      // Also emit to sender for confirmation
      io.to(`user_${senderId}`).emit('message_sent', {
        message: message.toJSON(),
        conversation: conversation.toJSON()
      });
    }

    logger.info(`Message sent from ${senderId} to ${receiverId}`);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        message: message.toJSON(),
        conversation: conversation.toJSON()
      }
    });

  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

/**
 * @swagger
 * /api/messages/{messageId}/read:
 *   put:
 *     summary: Mark a message as read
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message marked as read successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Message not found
 */
router.put('/:messageId/read', authenticateToken, validateMessageId, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Find message and check if user is the receiver
    const message = await Message.findOne({
      _id: messageId,
      receiver: userId,
      isDeleted: false
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Mark as read if not already read
    if (!message.isRead) {
      await message.markAsRead();

      // Emit read receipt to sender
      const io = getSocketIO();
      if (io) {
        io.to(`user_${message.sender}`).emit('message_read', {
          messageId: message._id,
          readAt: message.readAt
        });
      }

      logger.info(`Message ${messageId} marked as read by user ${userId}`);
    }

    res.json({
      success: true,
      message: 'Message marked as read successfully',
      data: {
        message: message.toJSON()
      }
    });

  } catch (error) {
    logger.error('Mark message as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read'
    });
  }
});

/**
 * @swagger
 * /api/messages/unread-count:
 *   get:
 *     summary: Get unread message count for current user
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const unreadCount = await Message.getUnreadCount(userId);

    res.json({
      success: true,
      message: 'Unread count retrieved successfully',
      data: {
        unreadCount
      }
    });

  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve unread count'
    });
  }
});

/**
 * @swagger
 * /api/messages/{messageId}:
 *   delete:
 *     summary: Delete a message (soft delete)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Message not found
 */
router.delete('/:messageId', authenticateToken, validateMessageId, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Find message and check if user is the sender
    const message = await Message.findOne({
      _id: messageId,
      sender: userId,
      isDeleted: false
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or access denied'
      });
    }

    // Soft delete the message
    await message.softDelete();

    // Emit deletion event
    const io = getSocketIO();
    if (io) {
      io.to(`user_${message.receiver}`).emit('message_deleted', {
        messageId: message._id,
        conversationId: message.conversation
      });
    }

    logger.info(`Message ${messageId} deleted by user ${userId}`);

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    logger.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message'
    });
  }
});

export default router;