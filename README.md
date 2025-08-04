# Real-Time Messaging System Backend

A comprehensive real-time messaging system built with Node.js, Express, MongoDB, RabbitMQ, Redis, and Socket.IO. This system provides secure user authentication, real-time messaging, automated message scheduling, and comprehensive user management.

## 🚀 Features

### Core Functionality
- **User Authentication & Authorization**: JWT-based authentication with refresh tokens
- **Real-time Messaging**: Socket.IO powered instant messaging
- **Automated Message System**: Scheduled auto-messages with RabbitMQ queue processing
- **Online User Tracking**: Redis-based online status management
- **Conversation Management**: Organized message threads and history
- **Message Status Tracking**: Read receipts and delivery confirmations

### Technical Features
- **Scalable Architecture**: Microservices-ready with queue-based processing
- **Security**: Rate limiting, input validation, and secure headers
- **Performance**: Redis caching and database indexing
- **Monitoring**: Comprehensive logging with Winston
- **API Documentation**: Swagger/OpenAPI integration
- **Error Handling**: Graceful error handling and retry mechanisms

## 🛠 Technology Stack

- **Runtime**: Node.js with ES6 modules
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Message Queue**: RabbitMQ
- **Cache**: Redis
- **Real-time**: Socket.IO
- **Authentication**: JWT (JSON Web Tokens)
- **Scheduling**: Node-cron
- **Logging**: Winston
- **Documentation**: Swagger UI
- **Validation**: Express-validator & Joi

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- Node.js (v18 or higher)
- MongoDB (v5.0 or higher)
- Redis (v6.0 or higher)
- RabbitMQ (v3.8 or higher)

## 🚀 Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd realtime-messaging-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   PORT=3000
   NODE_ENV=development
   
   MONGODB_URI=mongodb://localhost:27017/realtime_messaging
   
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   
   RABBITMQ_URL=amqp://localhost:5672
   
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   
   LOG_LEVEL=info
   LOG_FILE=logs/app.log
   ```

4. **Start the services**
   
   Make sure MongoDB, Redis, and RabbitMQ are running:
   ```bash
   # MongoDB
   mongod
   
   # Redis
   redis-server
   
   # RabbitMQ
   rabbitmq-server
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 📚 API Documentation

Once the server is running, you can access the API documentation at:
```
http://localhost:3000/api-docs
```

### Authentication Endpoints

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user profile

### User Management Endpoints

- `GET /api/user/list` - Get list of users
- `GET /api/user/online-stats` - Get online user statistics
- `PUT /api/user/profile` - Update user profile

### Messaging Endpoints

- `POST /api/messages/send` - Send a message
- `PUT /api/messages/:messageId/read` - Mark message as read
- `GET /api/messages/unread-count` - Get unread message count
- `DELETE /api/messages/:messageId` - Delete a message

### Conversation Endpoints

- `GET /api/conversations` - Get user's conversations
- `GET /api/conversations/:conversationId` - Get conversation details
- `GET /api/conversations/:conversationId/messages` - Get messages in conversation
- `PUT /api/conversations/:conversationId/mark-read` - Mark all messages as read

## 🔌 Socket.IO Events

### Client to Server Events

- `join_room` - Join a conversation room
- `leave_room` - Leave a conversation room
- `send_message` - Send a real-time message
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `message_read` - Mark message as read

### Server to Client Events

- `message_received` - New message received
- `message_sent` - Message sent confirmation
- `message_read` - Message read receipt
- `user_online` - User came online
- `user_offline` - User went offline
- `user_typing` - User typing indicator
- `new_message_notification` - New message notification

## 🤖 Automated Message System

The system includes a sophisticated 3-stage automated message system:

### Stage 1: Message Planning (Daily at 2:00 AM)
- Fetches all active users
- Randomly pairs users for messaging
- Creates scheduled auto-messages with random send times
- Stores messages in AutoMessage collection

### Stage 2: Queue Management (Every Minute)
- Scans for messages ready to be sent
- Publishes ready messages to RabbitMQ queue
- Marks messages as queued to prevent duplicates

### Stage 3: Message Delivery (RabbitMQ Consumer)
- Processes queued messages
- Creates actual Message documents
- Sends real-time notifications via Socket.IO
- Updates AutoMessage status as sent

## 📊 Data Models

### User Model
```javascript
{
  username: String,
  email: String,
  password: String (hashed),
  isActive: Boolean,
  lastSeen: Date,
  refreshTokens: [{ token: String, createdAt: Date }]
}
```

### Conversation Model
```javascript
{
  participants: [ObjectId],
  lastMessage: ObjectId,
  lastActivity: Date,
  isActive: Boolean
}
```

### Message Model
```javascript
{
  sender: ObjectId,
  receiver: ObjectId,
  conversation: ObjectId,
  content: String,
  messageType: String, // 'text' or 'auto'
  isRead: Boolean,
  readAt: Date,
  isDeleted: Boolean
}
```

### AutoMessage Model
```javascript
{
  sender: ObjectId,
  receiver: ObjectId,
  content: String,
  sendDate: Date,
  isQueued: Boolean,
  isSent: Boolean,
  messageId: ObjectId,
  retryCount: Number
}
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevents API abuse
- **Input Validation**: Comprehensive request validation
- **Security Headers**: Helmet.js for security headers
- **Password Hashing**: bcrypt for secure password storage
- **CORS Protection**: Configurable CORS policies

## 📈 Performance Optimizations

- **Database Indexing**: Optimized queries with proper indexes
- **Redis Caching**: Online user status and session management
- **Connection Pooling**: Efficient database connections
- **Pagination**: Efficient data loading for large datasets
- **Queue Processing**: Asynchronous message processing

## 🔧 Development

### Running Tests
```bash
npm test
```

### Code Linting
```bash
npm run lint
```

### Code Formatting
```bash
npm run format
```

### Environment Variables
All configuration is managed through environment variables. See `.env.example` for all available options.

## 📝 Logging

The application uses Winston for comprehensive logging:

- **Console Logging**: Development-friendly colored output
- **File Logging**: Persistent logs in `/logs` directory
- **Error Tracking**: Separate error logs
- **Log Levels**: Configurable log levels (error, warn, info, debug)

## 🚀 Deployment

### Production Considerations

1. **Environment Variables**: Set all production environment variables
2. **Database**: Use MongoDB Atlas or dedicated MongoDB instance
3. **Redis**: Use Redis Cloud or dedicated Redis instance
4. **RabbitMQ**: Use CloudAMQP or dedicated RabbitMQ instance
5. **Process Management**: Use PM2 or similar process manager
6. **Reverse Proxy**: Use Nginx for load balancing and SSL termination
7. **Monitoring**: Implement health checks and monitoring

### Docker Support
```dockerfile
# Example Dockerfile structure
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation at `/api-docs`
- Review the logs in the `/logs` directory

## 🔄 Version History

- **v1.0.0**: Initial release with core messaging functionality
- Real-time messaging with Socket.IO
- JWT authentication system
- Automated message scheduling
- Redis-based online user tracking
- Comprehensive API documentation