import cron from 'node-cron';
import User from '../models/User.js';
import AutoMessage from '../models/AutoMessage.js';
import { publishToQueue } from '../config/rabbitmq.js';
import logger from '../utils/logger.js';

// Array of sample auto messages
const AUTO_MESSAGE_TEMPLATES = [
  "Hey! How's your day going?",
  "Hope you're having a great time!",
  "Just wanted to say hello! 👋",
  "What's new with you today?",
  "Sending you positive vibes! ✨",
  "Hope your week is going well!",
  "Just checking in on you!",
  "Have a wonderful day ahead!",
  "Thinking of you today! 💭",
  "Hope you're doing amazing!",
  "Wishing you a fantastic day!",
  "Just wanted to brighten your day! ☀️",
  "Hope everything is going great for you!",
  "Sending you good energy today!",
  "Have an awesome day! 🌟"
];

// Shuffle array utility function
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Get random message content
const getRandomMessage = () => {
  const randomIndex = Math.floor(Math.random() * AUTO_MESSAGE_TEMPLATES.length);
  return AUTO_MESSAGE_TEMPLATES[randomIndex];
};

// Get random future date (1-24 hours from now)
const getRandomSendDate = () => {
  const now = new Date();
  const hoursToAdd = Math.floor(Math.random() * 24) + 1; // 1-24 hours
  const minutesToAdd = Math.floor(Math.random() * 60); // 0-59 minutes
  
  return new Date(now.getTime() + (hoursToAdd * 60 * 60 * 1000) + (minutesToAdd * 60 * 1000));
};

// Main cron job: Create auto messages (runs daily at 2:00 AM)
const createAutoMessages = async () => {
  try {
    logger.info('Starting auto message creation job...');

    // Get all active users
    const activeUsers = await User.find({ isActive: true }).select('_id username email');
    
    if (activeUsers.length < 2) {
      logger.warn('Not enough active users to create auto messages');
      return;
    }

    // Shuffle users randomly
    const shuffledUsers = shuffleArray(activeUsers);
    
    // Create pairs (sender, receiver)
    const pairs = [];
    for (let i = 0; i < shuffledUsers.length - 1; i += 2) {
      if (shuffledUsers[i + 1]) {
        pairs.push({
          sender: shuffledUsers[i],
          receiver: shuffledUsers[i + 1]
        });
      }
    }

    // If odd number of users, pair the last one with the first
    if (shuffledUsers.length % 2 !== 0) {
      pairs.push({
        sender: shuffledUsers[shuffledUsers.length - 1],
        receiver: shuffledUsers[0]
      });
    }

    // Create auto messages for each pair
    const autoMessages = pairs.map(pair => ({
      sender: pair.sender._id,
      receiver: pair.receiver._id,
      content: getRandomMessage(),
      sendDate: getRandomSendDate()
    }));

    // Bulk insert auto messages
    const createdMessages = await AutoMessage.insertMany(autoMessages);

    logger.info(`Created ${createdMessages.length} auto messages for ${pairs.length} user pairs`);

    // Log some statistics
    const stats = await AutoMessage.getStatistics();
    logger.info('Auto message statistics:', stats);

  } catch (error) {
    logger.error('Error in createAutoMessages cron job:', error);
  }
};

// Worker cron job: Queue messages ready to be sent (runs every minute)
const queueReadyMessages = async () => {
  try {
    logger.debug('Checking for messages ready to be queued...');

    // Get messages that are ready to be sent
    const readyMessages = await AutoMessage.getMessagesForQueuing();

    if (readyMessages.length === 0) {
      logger.debug('No messages ready for queuing');
      return;
    }

    logger.info(`Found ${readyMessages.length} messages ready for queuing`);

    // Process each message
    for (const autoMessage of readyMessages) {
      try {
        // Publish to RabbitMQ queue
        await publishToQueue('message_sending_queue', {
          autoMessageId: autoMessage._id,
          senderId: autoMessage.sender._id,
          receiverId: autoMessage.receiver._id,
          content: autoMessage.content,
          senderUsername: autoMessage.sender.username,
          receiverUsername: autoMessage.receiver.username
        });

        // Mark as queued
        await autoMessage.markAsQueued();

        logger.debug(`Auto message ${autoMessage._id} queued successfully`);

      } catch (error) {
        logger.error(`Error queuing auto message ${autoMessage._id}:`, error);
        
        // Increment retry count
        await autoMessage.incrementRetry(error.message);
      }
    }

    logger.info(`Successfully queued ${readyMessages.length} messages`);

  } catch (error) {
    logger.error('Error in queueReadyMessages cron job:', error);
  }
};

// Cleanup old auto messages (runs daily at 3:00 AM)
const cleanupOldMessages = async () => {
  try {
    logger.info('Starting cleanup of old auto messages...');

    // Delete auto messages older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await AutoMessage.deleteMany({
      createdAt: { $lt: thirtyDaysAgo },
      isSent: true
    });

    logger.info(`Cleaned up ${result.deletedCount} old auto messages`);

  } catch (error) {
    logger.error('Error in cleanupOldMessages cron job:', error);
  }
};

// Statistics logging (runs every hour)
const logStatistics = async () => {
  try {
    const stats = await AutoMessage.getStatistics();
    logger.info('Hourly auto message statistics:', stats);
  } catch (error) {
    logger.error('Error logging statistics:', error);
  }
};

export const startCronJobs = () => {
  // Main job: Create auto messages daily at 2:00 AM
  cron.schedule('0 2 * * *', createAutoMessages, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Worker job: Queue ready messages every minute
  cron.schedule('* * * * *', queueReadyMessages, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Cleanup job: Clean old messages daily at 3:00 AM
  cron.schedule('0 3 * * *', cleanupOldMessages, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Statistics job: Log stats every hour
  cron.schedule('0 * * * *', logStatistics, {
    scheduled: true,
    timezone: 'UTC'
  });

  logger.info('Cron jobs started successfully');
  logger.info('Scheduled jobs:');
  logger.info('- Auto message creation: Daily at 2:00 AM UTC');
  logger.info('- Message queuing: Every minute');
  logger.info('- Cleanup old messages: Daily at 3:00 AM UTC');
  logger.info('- Statistics logging: Every hour');

  // Run initial statistics
  setTimeout(logStatistics, 5000);
};