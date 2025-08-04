// MongoDB initialization script for Docker
db = db.getSiblingDB('realtime_messaging');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'email', 'password'],
      properties: {
        username: {
          bsonType: 'string',
          minLength: 3,
          maxLength: 30
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        },
        password: {
          bsonType: 'string',
          minLength: 6
        },
        isActive: {
          bsonType: 'bool'
        }
      }
    }
  }
});

db.createCollection('conversations');
db.createCollection('messages');
db.createCollection('automessages');

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ isActive: 1 });

db.conversations.createIndex({ participants: 1 });
db.conversations.createIndex({ lastActivity: -1 });
db.conversations.createIndex({ participants: 1, isActive: 1 });

db.messages.createIndex({ conversation: 1, createdAt: -1 });
db.messages.createIndex({ sender: 1 });
db.messages.createIndex({ receiver: 1 });
db.messages.createIndex({ receiver: 1, isRead: 1, isDeleted: 1 });

db.automessages.createIndex({ sendDate: 1, isQueued: 1, isSent: 1 });
db.automessages.createIndex({ isQueued: 1, isSent: 1, retryCount: 1 });

print('Database initialized successfully!');