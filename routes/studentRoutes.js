const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateStudent } = require('../middlewares/authMiddleware');
const Student = require('../models/Student');

// Protect all student routes with authentication middleware
router.use(authenticateStudent);

/**
 * @route GET /notifications/:rollNumber
 * @description Get class notifications for a student
 * @access Private (Student)
 */
router.get('/notifications/:rollNumber', studentController.fetchNotifications);

/**
 * @route POST /attendance
 * @description Submit student attendance
 * @access Private (Student)
 */
router.post('/attendance', studentController.submitAttendance);

/**
 * @route GET /attendance-history/:rollNumber
 * @description Get student's attendance history
 * @access Private (Student)
 */
router.get('/attendance-history/:rollNumber', studentController.getAttendanceHistory);

/**
 * @route POST /enroll-face
 * @description Enroll student's face for facial recognition
 * @access Private (Student)
 */
// Add to studentRoutes.js
router.post('/enroll-face', authenticateStudent, async (req, res) => {
  try {
    const { rollNumber, faceEmbedding, version } = req.body;
    
    // Validate input
    if (!rollNumber || !faceEmbedding) {
      return res.status(400).json({ 
        success: false, 
        message: 'Roll number and face embedding are required' 
      });
    }
    
    // Check if face embedding is too large
    if (faceEmbedding.length > 10000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Face data too large' 
      });
    }
    
    // Update student record with face data
    const updatedStudent = await Student.findOneAndUpdate(
      { rollNumber },
      { 
        faceEmbedding,
        faceEnrollmentDate: new Date(),
        faceEnrollmentVersion: version || '3.0'
      },
      { new: true }
    );
    
    if (!updatedStudent) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Face enrollment completed successfully'
    });
    
  } catch (error) {
    console.error('Face enrollment error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error enrolling face data',
      error: error.message 
    });
  }
});

/**
 * @route POST /verify-face-attendance
 * @description Verify face for attendance marking
 * @access Private (Student)
 */
router.post('/verify-face-attendance', studentController.verifyFaceAttendance);

/**
 * @route GET /face-status/:rollNumber
 * @description Check student's face enrollment status
 * @access Private (Student)
 */
router.get('/face-status/:rollNumber', studentController.getFaceEnrollmentStatus);

/**
 * @route POST /reset-face-enrollment
 * @description Reset student's face enrollment data
 * @access Private (Student)
 */
router.post('/reset-face-enrollment', studentController.resetFaceEnrollment);

module.exports = router;
