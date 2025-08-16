const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  rollNumber: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  department: { 
    type: String, 
    required: true 
  },
  year: { 
    type: Number, 
    required: true 
  },
  deviceId: { 
    type: String, 
    unique: true, 
    sparse: true 
  },
  // Face Recognition Fields
  faceEmbedding: {
    type: String,
    default: null
  },
  faceEnrolled: {
    type: Boolean,
    default: false
  },
  faceEnrollmentDate: {
    type: Date,
    default: null
  },
  livenessSteps: [{
    step: Number,
    action: String,
    timestamp: Date
  }],
  faceVerificationAttempts: {
    type: Number,
    default: 0
  },
  lastFaceVerification: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient face verification queries
studentSchema.index({ rollNumber: 1, faceEnrolled: 1 });

// Method to increment face verification attempts
studentSchema.methods.incrementFaceVerificationAttempts = function() {
  this.faceVerificationAttempts += 1;
  this.lastFaceVerification = new Date();
  return this.save();
};

// Method to reset face verification attempts
studentSchema.methods.resetFaceVerificationAttempts = function() {
  this.faceVerificationAttempts = 0;
  return this.save();
};

// Static method to find students with face enrollment
studentSchema.statics.findWithFaceEnrollment = function() {
  return this.find({ faceEnrolled: true });
};

module.exports = mongoose.model('Student', studentSchema);
