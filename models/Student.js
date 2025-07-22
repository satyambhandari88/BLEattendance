// ✅ Updated Student Schema (Student.js)
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  rollNumber: String,
  department: String,
  year: String,
  deviceId: {
    type: String,
    default: null
  }
});

module.exports = mongoose.model('Student', studentSchema);
