import mongoose from 'mongoose';

const autoMessageSchema = new mongoose.Schema({
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
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  sendDate: {
    type: Date,
    required: true
  },
  isQueued: {
    type: Boolean,
    default: false
  },
  queuedAt: {
    type: Date
  },
  isSent: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  error: {
    type: String
  },
  retryCount: {
    type: Number,
    default: 0
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
autoMessageSchema.index({ sendDate: 1 });
autoMessageSchema.index({ isQueued: 1 });
autoMessageSchema.index({ isSent: 1 });
autoMessageSchema.index({ sender: 1 });
autoMessageSchema.index({ receiver: 1 });

// Compound indexes for cron job queries
autoMessageSchema.index({ 
  sendDate: 1, 
  isQueued: 1, 
  isSent: 1 
});

autoMessageSchema.index({ 
  isQueued: 1, 
  isSent: 1, 
  retryCount: 1 
});

// Method to mark as queued
autoMessageSchema.methods.markAsQueued = function() {
  this.isQueued = true;
  this.queuedAt = new Date();
  return this.save();
};

// Method to mark as sent
autoMessageSchema.methods.markAsSent = function(messageId) {
  this.isSent = true;
  this.sentAt = new Date();
  this.messageId = messageId;
  return this.save();
};

// Method to increment retry count
autoMessageSchema.methods.incrementRetry = function(error = null) {
  this.retryCount += 1;
  if (error) {
    this.error = error;
  }
  return this.save();
};

// Static method to get messages ready for queuing
autoMessageSchema.statics.getMessagesForQueuing = async function() {
  try {
    return await this.find({
      sendDate: { $lte: new Date() },
      isQueued: false,
      isSent: false,
      retryCount: { $lt: 3 }
    }).populate('sender receiver', 'username email');
  } catch (error) {
    throw error;
  }
};

// Static method to get statistics
autoMessageSchema.statics.getStatistics = async function() {
  try {
    const stats = await this.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          queued: { $sum: { $cond: ['$isQueued', 1, 0] } },
          sent: { $sum: { $cond: ['$isSent', 1, 0] } },
          failed: { $sum: { $cond: [{ $gte: ['$retryCount', 3] }, 1, 0] } },
          pending: { 
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $eq: ['$isQueued', false] },
                    { $eq: ['$isSent', false] },
                    { $lt: ['$retryCount', 3] }
                  ]
                }, 
                1, 
                0
              ] 
            } 
          }
        }
      }
    ]);

    return stats[0] || {
      total: 0,
      queued: 0,
      sent: 0,
      failed: 0,
      pending: 0
    };
  } catch (error) {
    throw error;
  }
};

export default mongoose.model('AutoMessage', autoMessageSchema);