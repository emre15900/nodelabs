import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  messageType: {
    type: String,
    enum: ['text', 'auto'],
    default: 'text'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for better query performance
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ receiver: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ messageType: 1 });
messageSchema.index({ isDeleted: 1 });

// Compound indexes
messageSchema.index({ 
  conversation: 1, 
  isDeleted: 1, 
  createdAt: -1 
});

messageSchema.index({ 
  receiver: 1, 
  isRead: 1, 
  isDeleted: 1 
});

// Method to mark message as read
messageSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Method to soft delete message
messageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Static method to get unread message count for a user
messageSchema.statics.getUnreadCount = async function(userId) {
  try {
    return await this.countDocuments({
      receiver: userId,
      isRead: false,
      isDeleted: false
    });
  } catch (error) {
    throw error;
  }
};

// Static method to mark all messages in a conversation as read
messageSchema.statics.markConversationAsRead = async function(conversationId, userId) {
  try {
    return await this.updateMany(
      {
        conversation: conversationId,
        receiver: userId,
        isRead: false,
        isDeleted: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );
  } catch (error) {
    throw error;
  }
};

export default mongoose.model('Message', messageSchema);