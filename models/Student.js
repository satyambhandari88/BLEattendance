const mongoose = require('mongoose');

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
  faceEmbedding: {
    type: String, // Standardized format for face data
  },
  faceEnrollmentDate: {
    type: Date,
  },
  faceEnrollmentVersion: {
    type: String,
    default: '3.0'
  }
}, { timestamps: true });

module.exports = mongoose.model('Student', StudentSchema);
