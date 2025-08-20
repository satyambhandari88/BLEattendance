const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const StudentSchema = new mongoose.Schema({
  rollNumber: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  department: {
    type: String,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  // Enhanced face data storage - optimized for fast verification
  faceEmbedding: {
    type: String, // Stores 256 comma-separated float values as string
    default: null
  },
  faceEnrollmentData: {
    samples: {
      type: Number,
      default: 0
    },
    enrollmentDate: {
      type: Date,
      default: null
    },
    avgQuality: {
      type: Number,
      default: 0
    },
    version: {
      type: String,
      default: '3.0'
    }
  },
  // Face verification statistics
  verificationStats: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    successfulVerifications: {
      type: Number,
      default: 0
    },
    lastVerified: {
      type: Date,
      default: null
    },
    averageSimilarity: {
      type: Number,
      default: 0
    }
  }
}, { timestamps: true });

// Encrypt password before saving
StudentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
StudentSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if face is enrolled
StudentSchema.methods.hasFaceEnrolled = function () {
  return !!(this.faceEmbedding && 
           this.faceEmbedding.length > 100 && 
           this.faceEnrollmentData.samples > 0);
};

// Update verification stats
StudentSchema.methods.updateVerificationStats = function (similarity, isSuccess) {
  this.verificationStats.totalAttempts += 1;
  
  if (isSuccess) {
    this.verificationStats.successfulVerifications += 1;
    this.verificationStats.lastVerified = new Date();
  }
  
  // Update running average of similarity scores
  const totalSuccessful = this.verificationStats.successfulVerifications;
  if (totalSuccessful > 0) {
    const currentAvg = this.verificationStats.averageSimilarity || 0;
    this.verificationStats.averageSimilarity = 
      ((currentAvg * (totalSuccessful - 1)) + similarity) / totalSuccessful;
  }
  
  return this.save();
};

// Get face template as array
StudentSchema.methods.getFaceTemplate = function () {
  if (!this.faceEmbedding) return null;
  
  try {
    return this.faceEmbedding.split('|').map(f => parseFloat(f));
  } catch (error) {
    console.error('Error parsing face template:', error);
    return null;
  }
};

// Set face template from array
StudentSchema.methods.setFaceTemplate = function (templateArray, enrollmentData = {}) {
  if (!Array.isArray(templateArray) || templateArray.length !== 256) {
    throw new Error('Invalid face template: must be array of 256 numbers');
  }
  
  this.faceEmbedding = templateArray.map(f => f.toFixed(6)).join('|');
  
  // Update enrollment data
  this.faceEnrollmentData = {
    samples: enrollmentData.samples || 3,
    enrollmentDate: new Date(),
    avgQuality: enrollmentData.avgQuality || 0,
    version: enrollmentData.version || '3.0'
  };
  
  return this;
};

// Calculate verification success rate
StudentSchema.methods.getVerificationSuccessRate = function () {
  const { totalAttempts, successfulVerifications } = this.verificationStats;
  return totalAttempts > 0 ? (successfulVerifications / totalAttempts) * 100 : 0;
};

module.exports = mongoose.model('Student', StudentSchema);
