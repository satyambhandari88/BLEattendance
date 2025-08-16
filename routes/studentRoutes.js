const express = require('express');
const router = express.Router();
const { 
  fetchNotifications, 
  submitAttendance, 
  getAttendanceHistory , enrollFace , verifyFace
} = require('../controllers/studentController');
const { authenticateStudent } = require('../middlewares/authMiddleware');


// Protect all routes
router.use(authenticateStudent);

// Get class notifications
router.get('/notifications/:rollNumber', fetchNotifications);

// Submit attendance
router.post('/attendance', submitAttendance);

// Get attendance history
router.get('/attendance-history/:rollNumber', getAttendanceHistory);


router.post('/enroll-face', enrollFace);
router.post('/verify-face', verifyFace);

// Add these routes to your student routes file
router.post('/enroll-face', studentController.enrollFace);
router.post('/verify-face-attendance', studentController.verifyFaceAttendance);
router.get('/face-status/:rollNumber', studentController.getFaceEnrollmentStatus);
router.post('/reset-face-enrollment', studentController.resetFaceEnrollment);

module.exports = router;
