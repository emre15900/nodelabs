import { consumeFromQueue } from '../config/rabbitmq.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import AutoMessage from '../models/AutoMessage.js';
import { emitToUser } from '../socket/socketHandler.js';
import logger from '../utils/logger.js';

// Process auto message from queue
const processAutoMessage = async (messageData) => {
  try {
    const {
      autoMessageId,
      senderId,
      receiverId,
      content,
      senderUsername,
      receiverUsername
    } = messageData;

    logger.debug(`Processing auto message ${autoMessageId} from ${senderUsername} to ${receiverUsername}`);

    // Find or create conversation between sender and receiver
    const conversation = await Conversation.findOrCreateConversation(senderId, receiverId);

    // Create the actual message
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      conversation: conversation._id,
      content,
      messageType: 'auto'
    });

    await message.save();

    // Update conversation last activity
    await conversation.updateLastActivity(message._id);

    // Populate message for socket emission
    await message.populate([
      { path: 'sender', select: 'username email' },
      { path: 'receiver', select: 'username email' }
    ]);

    // Send real-time notification to receiver
    emitToUser(receiverId, 'message_received', {
      message: message.toJSON(),
      conversation: conversation.toJSON(),
      isAutoMessage: true
    });

    // Update AutoMessage record as sent
    const autoMessage = await AutoMessage.findById(autoMessageId);
    if (autoMessage) {
      await autoMessage.markAsSent(message._id);
    }

    logger.info(`Auto message sent successfully: ${autoMessageId} -> Message: ${message._id}`);

  } catch (error) {
    logger.error('Error processing auto message:', error);

    // Update AutoMessage with error
    try {
      const autoMessage = await AutoMessage.findById(messageData.autoMessageId);
      if (autoMessage) {
        await autoMessage.incrementRetry(error.message);
      }
    } catch (updateError) {
      logger.error('Error updating AutoMessage retry count:', updateError);
    }

    throw error; // Re-throw to trigger message requeue
  }
};

// Start the message consumer
export const startMessageConsumer = async () => {
  try {
    logger.info('Starting message consumer...');

    await consumeFromQueue('message_sending_queue', processAutoMessage);

    logger.info('Message consumer started successfully');

  } catch (error) {
    logger.error('Failed to start message consumer:', error);
    throw error;
  }
};

// Get consumer statistics
export const getConsumerStats = async () => {
  try {
    const stats = await AutoMessage.getStatistics();
    return {
      ...stats,
      timestamp: new Date(),
      consumerStatus: 'running'
    };
  } catch (error) {
    logger.error('Error getting consumer stats:', error);
    return {
      error: error.message,
      timestamp: new Date(),
      consumerStatus: 'error'
    };
  }
};