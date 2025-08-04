import { createClient } from 'redis';
import logger from '../utils/logger.js';

let redisClient;

export const connectRedis = async () => {
  try {
    redisClient = createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis Client Ready');
    });

    redisClient.on('end', () => {
      logger.warn('Redis Client Disconnected');
    });

    await redisClient.connect();
    
    // Test the connection
    await redisClient.ping();
    logger.info('Redis connection successful');

  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

// Online users management
export const addOnlineUser = async (userId) => {
  try {
    await redisClient.sAdd('online_users', userId.toString());
    logger.debug(`User ${userId} added to online users`);
  } catch (error) {
    logger.error('Error adding online user:', error);
  }
};

export const removeOnlineUser = async (userId) => {
  try {
    await redisClient.sRem('online_users', userId.toString());
    logger.debug(`User ${userId} removed from online users`);
  } catch (error) {
    logger.error('Error removing online user:', error);
  }
};

export const getOnlineUsers = async () => {
  try {
    return await redisClient.sMembers('online_users');
  } catch (error) {
    logger.error('Error getting online users:', error);
    return [];
  }
};

export const isUserOnline = async (userId) => {
  try {
    return await redisClient.sIsMember('online_users', userId.toString());
  } catch (error) {
    logger.error('Error checking if user is online:', error);
    return false;
  }
};

export const getOnlineUserCount = async () => {
  try {
    return await redisClient.sCard('online_users');
  } catch (error) {
    logger.error('Error getting online user count:', error);
    return 0;
  }
};