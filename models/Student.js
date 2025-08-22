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
  deviceId: {
    type: String,
    default: null,
  },
  year: {
    type: Number,
    required: true,
  },
  // UPDATED: Enhanced face recognition fields
  faceEmbedding: {
    type: String,
    default: null,
    index: true // Add index for faster queries
  },
  faceEnrolled: {
    type: Boolean,
    default: false,
    index: true
  },
  faceEnrollmentDate: {
    type: Date,
    default: null
  },
  enrollmentSteps: {
    type: Number,
    default: 0
  },
  enrollmentVersion: {
    type: String,
    default: '1.0'
  },
  faceVerificationHash: {
    type: String,
    default: null
  },
  livenessSteps: {
    type: Array,
    default: []
  },
  // Legacy field for backward compatibility
  faceData: {
    type: String,
    default: null
  },
  // Performance optimization fields
  lastVerificationAttempt: {
    type: Date,
    default: null
  },
  verificationAttempts: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true,
  // Add indexes for better query performance
  indexes: [
    { rollNumber: 1 },
    { faceEnrolled: 1 },
    { department: 1, year: 1 }
  ]
});

// Add method to check if face enrollment is valid
StudentSchema.methods.isFaceEnrollmentValid = function() {
  return this.faceEnrolled && 
         this.faceEmbedding && 
         this.faceEmbedding.length > 100 &&
         this.faceEnrollmentDate &&
         (Date.now() - this.faceEnrollmentDate.getTime()) < (90 * 24 * 60 * 60 * 1000); // Valid for 90 days
};

// Add method to reset verification attempts
StudentSchema.methods.resetVerificationAttempts = function() {
  this.verificationAttempts = 0;
  this.lastVerificationAttempt = null;
  return this.save();
};

module.exports = mongoose.model('Student', StudentSchema);
