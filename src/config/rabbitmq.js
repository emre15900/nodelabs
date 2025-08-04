import amqp from 'amqplib';
import logger from '../utils/logger.js';

let connection;
let channel;

export const connectRabbitMQ = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
    channel = await connection.createChannel();

    // Create queues
    await channel.assertQueue('message_sending_queue', {
      durable: true,
      arguments: {
        'x-message-ttl': 86400000, // 24 hours TTL
        'x-max-retries': 3
      }
    });

    logger.info('RabbitMQ connected and queues created');

    // Handle connection events
    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err);
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
    });

  } catch (error) {
    logger.error('RabbitMQ connection failed:', error);
    throw error;
  }
};

export const getChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  return channel;
};

export const publishToQueue = async (queueName, message) => {
  try {
    const messageBuffer = Buffer.from(JSON.stringify(message));
    await channel.sendToQueue(queueName, messageBuffer, {
      persistent: true,
      timestamp: Date.now()
    });
    logger.debug(`Message published to queue ${queueName}:`, message);
  } catch (error) {
    logger.error('Error publishing to queue:', error);
    throw error;
  }
};

export const consumeFromQueue = async (queueName, callback) => {
  try {
    await channel.consume(queueName, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await callback(content);
          channel.ack(msg);
          logger.debug(`Message processed from queue ${queueName}`);
        } catch (error) {
          logger.error('Error processing message:', error);
          // Reject and requeue the message for retry
          channel.nack(msg, false, true);
        }
      }
    });
    logger.info(`Started consuming from queue: ${queueName}`);
  } catch (error) {
    logger.error('Error setting up queue consumer:', error);
    throw error;
  }
};