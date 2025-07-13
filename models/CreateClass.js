const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  year: { type: String, required: true },
  branch: { type: String, required: true },
  subject: { type: String, required: true },
  className: { type: String, required: true },
  teacherName: { type: String, required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  day: { type: String, required: true },
  date: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  classCode: { type: String, required: true, unique: true, length: 5 },
  status: { 
    type: String, 
    enum: ['Scheduled', 'Completed', 'Cancelled'], 
    default: 'Scheduled' 
  },
  description: { type: String },
  location: { type: String },
  maxStudents: { type: Number, default: 50 },
  isActive: { type: Boolean, default: true }
}, { 
  timestamps: true 
});


// Index for better query performance
classSchema.index({ teacherId: 1, date: -1 });
classSchema.index({ classCode: 1 });

module.exports = mongoose.model('Class', classSchema);