const express = require('express');
const router = express.Router();

const {
  enrollFace,
  faceStatus,
  verifyFace,
  removeFace,
  fetchNotifications,
  submitAttendance,
  getAttendanceHistory,
  getFaceEnrollmentStatus,
  resetFaceEnrollment,
  verifyFaceAttendance
} = require('../controllers/studentController');

const { authenticateStudent } = require('../middlewares/authMiddleware');

// Protect all routes
router.use(authenticateStudent);

// ===== Face enrollment & verification =====
router.post('/face/enroll', enrollFace);
router.get('/face/status', faceStatus);
router.post('/face/verify', verifyFace);
router.delete('/face/remove', removeFace);
router.get('/face/enrollment-status/:rollNumber', getFaceEnrollmentStatus);
router.post('/face/reset-enrollment', resetFaceEnrollment);
router.post('/face/verify-attendance', verifyFaceAttendance);

// ===== Class notifications =====
router.get('/notifications/:rollNumber', fetchNotifications);

// ===== Attendance routes =====
router.post('/attendance', submitAttendance);
router.get('/attendance-history/:rollNumber', getAttendanceHistory);

module.exports = router;
