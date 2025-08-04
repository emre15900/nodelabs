import express from 'express';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { authenticateToken } from '../middleware/auth.js';
import { 
  validateConversationId, 
  validateGetMessages 
} from '../middleware/validation.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/conversations:
 *   get:
 *     summary: Get user's conversations
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Number of conversations per page
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const userId = req.user._id;

    // Get conversations where user is a participant
    const [conversations, totalConversations] = await Promise.all([
      Conversation.find({
        participants: userId,
        isActive: true
      })
        .populate('participants', 'username email lastSeen')
        .populate({
          path: 'lastMessage',
          populate: {
            path: 'sender',
            select: 'username'
          }
        })
        .sort({ lastActivity: -1 })
        .skip(skip)
        .limit(limit),
      
      Conversation.countDocuments({
        participants: userId,
        isActive: true
      })
    ]);

    // Get unread message counts for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conversation) => {
        const unreadCount = await Message.countDocuments({
          conversation: conversation._id,
          receiver: userId,
          isRead: false,
          isDeleted: false
        });

        return {
          ...conversation.toJSON(),
          unreadCount
        };
      })
    );

    const totalPages = Math.ceil(totalConversations / limit);

    res.json({
      success: true,
      message: 'Conversations retrieved successfully',
      data: {
        conversations: conversationsWithUnread,
        pagination: {
          currentPage: page,
          totalPages,
          totalConversations,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversations'
    });
  }
});

/**
 * @swagger
 * /api/conversations/{conversationId}:
 *   get:
 *     summary: Get conversation details
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Conversation not found
 */
router.get('/:conversationId', authenticateToken, validateConversationId, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
      isActive: true
    })
      .populate('participants', 'username email lastSeen')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'username'
        }
      });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Get unread message count
    const unreadCount = await Message.countDocuments({
      conversation: conversationId,
      receiver: userId,
      isRead: false,
      isDeleted: false
    });

    res.json({
      success: true,
      message: 'Conversation retrieved successfully',
      data: {
        conversation: {
          ...conversation.toJSON(),
          unreadCount
        }
      }
    });

  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversation'
    });
  }
});

/**
 * @swagger
 * /api/conversations/{conversationId}/messages:
 *   get:
 *     summary: Get messages in a conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of messages per page
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Conversation not found
 */
router.get('/:conversationId/messages', authenticateToken, validateGetMessages, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const userId = req.user._id;

    // Check if user is participant in the conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
      isActive: true
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Get messages with pagination (newest first)
    const [messages, totalMessages] = await Promise.all([
      Message.find({
        conversation: conversationId,
        isDeleted: false
      })
        .populate('sender', 'username')
        .populate('receiver', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      
      Message.countDocuments({
        conversation: conversationId,
        isDeleted: false
      })
    ]);

    const totalPages = Math.ceil(totalMessages / limit);

    res.json({
      success: true,
      message: 'Messages retrieved successfully',
      data: {
        messages: messages.reverse(), // Reverse to show oldest first in the response
        pagination: {
          currentPage: page,
          totalPages,
          totalMessages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages'
    });
  }
});

/**
 * @swagger
 * /api/conversations/{conversationId}/mark-read:
 *   put:
 *     summary: Mark all messages in conversation as read
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Messages marked as read successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Conversation not found
 */
router.put('/:conversationId/mark-read', authenticateToken, validateConversationId, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Check if user is participant in the conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
      isActive: true
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Mark all unread messages as read
    const result = await Message.markConversationAsRead(conversationId, userId);

    logger.info(`User ${userId} marked ${result.modifiedCount} messages as read in conversation ${conversationId}`);

    res.json({
      success: true,
      message: 'Messages marked as read successfully',
      data: {
        markedCount: result.modifiedCount
      }
    });

  } catch (error) {
    logger.error('Mark messages as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read'
    });
  }
});

export default router;