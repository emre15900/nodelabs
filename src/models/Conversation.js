import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
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
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastActivity: -1 });
conversationSchema.index({ isActive: 1 });

// Compound index for finding conversations between specific users
conversationSchema.index({ 
  participants: 1, 
  isActive: 1 
});

// Static method to find or create conversation between two users
conversationSchema.statics.findOrCreateConversation = async function(userId1, userId2) {
  try {
    // Look for existing conversation between these two users
    let conversation = await this.findOne({
      participants: { $all: [userId1, userId2] },
      isActive: true
    }).populate('participants', 'username email')
      .populate('lastMessage');

    // If no conversation exists, create a new one
    if (!conversation) {
      conversation = await this.create({
        participants: [userId1, userId2]
      });
      
      // Populate the newly created conversation
      conversation = await this.findById(conversation._id)
        .populate('participants', 'username email')
        .populate('lastMessage');
    }

    return conversation;
  } catch (error) {
    throw error;
  }
};

// Method to update last activity
conversationSchema.methods.updateLastActivity = function(messageId = null) {
  this.lastActivity = new Date();
  if (messageId) {
    this.lastMessage = messageId;
  }
  return this.save();
};

export default mongoose.model('Conversation', conversationSchema);