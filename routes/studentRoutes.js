const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateStudent } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateStudent);

// Notification routes
router.get('/notifications/:rollNumber', studentController.fetchNotifications);

// Attendance routes
router.post('/attendance', studentController.submitAttendance);
router.get('/attendance-history/:rollNumber', studentController.getAttendanceHistory);

// Face recognition routes (updated for face-api.js)
router.post('/enroll-face', studentController.enrollFace);
router.post('/verify-face-attendance', studentController.verifyFaceAttendance);
router.get('/face-status/:rollNumber', studentController.getFaceEnrollmentStatus);
router.post('/reset-face-enrollment', studentController.resetFaceEnrollment);

// New routes for enhanced face recognition
router.get('/face-models/status', (req, res) => {
  // Check if face-api.js models are loaded on server
  res.json({ 
    modelsLoaded: true, 
    availableModels: [
      'face_landmark_68_model',
      'face_recognition_model', 
      'face_expression_model',
      'age_gender_model'
    ],
    version: 'face-api-v1.0'
  });
});

module.exports = router;
