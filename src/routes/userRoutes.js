import express from 'express';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateUserList } from '../middleware/validation.js';
import { getOnlineUsers, getOnlineUserCount } from '../config/redis.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/user/list:
 *   get:
 *     summary: Get list of users
 *     tags: [Users]
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
 *           maximum: 100
 *         description: Number of users per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for username or email
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/list', authenticateToken, validateUserList, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    // Build search query
    let query = { 
      isActive: true,
      _id: { $ne: req.user._id } // Exclude current user
    };

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Get users with pagination
    const [users, totalUsers] = await Promise.all([
      User.find(query)
        .select('username email lastSeen createdAt')
        .sort({ lastSeen: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    // Get online users to mark status
    const onlineUserIds = await getOnlineUsers();
    const onlineSet = new Set(onlineUserIds);

    // Add online status to users
    const usersWithStatus = users.map(user => ({
      ...user.toJSON(),
      isOnline: onlineSet.has(user._id.toString())
    }));

    const totalPages = Math.ceil(totalUsers / limit);

    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users: usersWithStatus,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users'
    });
  }
});

/**
 * @swagger
 * /api/user/online-stats:
 *   get:
 *     summary: Get online user statistics
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Online statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/online-stats', authenticateToken, async (req, res) => {
  try {
    const [onlineUsers, onlineCount, totalUsers] = await Promise.all([
      getOnlineUsers(),
      getOnlineUserCount(),
      User.countDocuments({ isActive: true })
    ]);

    res.json({
      success: true,
      message: 'Online statistics retrieved successfully',
      data: {
        onlineCount,
        totalUsers,
        onlinePercentage: totalUsers > 0 ? ((onlineCount / totalUsers) * 100).toFixed(2) : 0,
        onlineUsers: onlineUsers // For debugging purposes
      }
    });

  } catch (error) {
    logger.error('Get online stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve online statistics'
    });
  }
});

/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error or username/email already exists
 *       401:
 *         description: Unauthorized
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { username, email } = req.body;
    const user = req.user;

    // Check if username or email already exists (excluding current user)
    if (username || email) {
      const existingUser = await User.findOne({
        $and: [
          { _id: { $ne: user._id } },
          {
            $or: [
              ...(username ? [{ username }] : []),
              ...(email ? [{ email }] : [])
            ]
          }
        ]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: existingUser.username === username 
            ? 'Username already taken' 
            : 'Email already registered'
        });
      }
    }

    // Update user
    if (username) user.username = username;
    if (email) user.email = email;

    await user.save();

    logger.info(`User profile updated: ${user.email}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.toJSON()
      }
    });

  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

export default router;