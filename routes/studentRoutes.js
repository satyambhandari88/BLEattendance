const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateStudent } = require('../middlewares/authMiddleware');

router.use(authenticateStudent);
router.get('/notifications/:rollNumber', studentController.fetchNotifications);
router.post('/attendance', studentController.submitAttendance);
router.get('/attendance-history/:rollNumber', studentController.getAttendanceHistory);
router.post('/enroll-face', studentController.enrollFace);
router.post('/verify-face-attendance', studentController.verifyFaceAttendance);
router.get('/face-status/:rollNumber', studentController.getFaceEnrollmentStatus);
router.post('/reset-face-enrollment', studentController.resetFaceEnrollment);

module.exports = router;
