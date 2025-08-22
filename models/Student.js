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
  faceEnrolled: { type: Boolean, default: false },
  faceEmbedding: { type: String, default: null },
  faceEnrollmentDate: { type: Date, default: null },
  livenessSteps: { type: [Object], default: [] }
}, { timestamps: true });



module.exports = mongoose.model('Student', StudentSchema);
