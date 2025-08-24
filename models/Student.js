const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const StudentSchema = new mongoose.Schema({
  rollNumber: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  department: { type: String, required: true },
  deviceId: { type: String, default: null },
  year: { type: Number, required: true },
  
  // Face recognition data using face-api.js
  faceDescriptors: [{ 
    type: [Number], // Array of 128 floating point numbers from face-api.js
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length === 128 && v.every(num => typeof num === 'number');
      },
      message: 'Face descriptor must be an array of 128 numbers'
    }
  }],
  
  faceDetectionData: {
    confidence: { type: Number, default: 0 },
    landmarks: { type: mongoose.Schema.Types.Mixed },
    expressions: { type: mongoose.Schema.Types.Mixed },
    ageGender: { type: mongoose.Schema.Types.Mixed }
  },
  
  faceEnrolled: { type: Boolean, default: false },
  faceEnrollmentDate: { type: Date, default: null },
  lastLoginAt: { type: Date, default: null },
  
  // Deprecated - keeping for backward compatibility
  faceData: { type: String },
  faceEmbedding: { type: String } // Also keeping for backward compatibility
}, { timestamps: true });

// Hash password before saving (only for new passwords)
StudentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
  if (this.password.match(/^\$2[aby]\$/)) {
    return next();
  }
  
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method - supports both hashed and plain text (for backward compatibility)
StudentSchema.methods.comparePassword = async function(candidatePassword) {
  // If password starts with bcrypt format, use bcrypt compare
  if (this.password.match(/^\$2[aby]\$/)) {
    return bcrypt.compare(candidatePassword, this.password);
  }
  
  // Otherwise, use plain text comparison (for existing plain text passwords)
  return this.password === candidatePassword;
};

// Check if face is enrolled
StudentSchema.methods.isFaceEnrolled = function() {
  return this.faceEnrolled && this.faceDescriptors && this.faceDescriptors.length > 0;
};

// Get face enrollment status
StudentSchema.methods.getFaceStatus = function() {
  return {
    enrolled: this.faceEnrolled || false,
    enrollmentDate: this.faceEnrollmentDate,
    descriptorCount: this.faceDescriptors ? this.faceDescriptors.length : 0,
    hasDetectionData: !!this.faceDetectionData,
    hasLegacyData: !!(this.faceData || this.faceEmbedding)
  };
};

module.exports = mongoose.model('Student', StudentSchema);
