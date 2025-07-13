const express = require('express');
const { 
  createClass, 
  getTeacherClasses, 
  getClassAttendance, 
  updateClass, 
  cancelClass, 
  getClassStats 
} = require('../controllers/teacherController');
const auth = require('../middlewares/auth'); // JWT authentication middleware
const router = express.Router();

// All routes require authentication
router.use(auth);

// Create Class Route
router.post('/create-class', auth, createClass);

// Get all classes for logged-in teacher
router.get('/classes', getTeacherClasses);

// Get attendance for a specific class
router.get('/classes/:classId/attendance', getClassAttendance);

// Update/Edit class
router.put('/classes/:classId', updateClass);

// Cancel/Delete class
router.delete('/classes/:classId', cancelClass);

// Get class statistics
router.get('/stats', getClassStats);

module.exports = router;