const AddClass = require('../models/AddClass');
const CreateClass = require('../models/CreateClass');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const haversine = require('haversine-distance');
const moment = require('moment-timezone');

// Helper function to mark absent students
const markAbsentStudents = async (classDetails) => {
  try {
    const today = moment().tz('Asia/Kolkata').startOf('day');
    const classDate = moment.tz(`${classDetails.date} ${classDetails.startTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
    const attendanceWindowEnd = moment(classDate).add(15, 'minutes');

    // Only proceed if current time is after attendance window
    if (moment().tz('Asia/Kolkata').isAfter(attendanceWindowEnd)) {
      // Get all students who should attend this class
      const students = await Student.find({
        year: classDetails.year.toString(),
        department: classDetails.branch
      });

      // For each student, check if attendance exists, if not mark as absent
      for (const student of students) {
        const existingAttendance = await Attendance.findOne({
          rollNumber: student.rollNumber,
          className: classDetails.className,
          subject: classDetails.subject,
          time: {
            $gte: today.toDate(),
            $lt: moment(today).endOf('day').toDate()
          }
        });

        if (!existingAttendance) {
          const absentAttendance = new Attendance({
            rollNumber: student.rollNumber,
            classId: classDetails._id,
            className: classDetails.className,
            subject: classDetails.subject,
            classCode: classDetails.classCode,
            status: 'Absent',
            time: attendanceWindowEnd.toDate(),
            autoMarked: true
          });
          await absentAttendance.save();
          console.log(`Automatically marked absent for ${student.rollNumber} in ${classDetails.className}`);
        }
      }
    }
  } catch (error) {
    console.error('Error in markAbsentStudents:', error);
  }
};

// Helper function to verify face embeddings
const verifyFaceEmbedding = (storedEmbedding, currentEmbedding) => {
  try {
    if (!storedEmbedding || !currentEmbedding) {
      return {
        isValid: false,
        similarity: 0,
        error: 'Missing embedding data'
      };
    }

    // Split stored embedding by steps (from enrollment)
    const storedSteps = storedEmbedding.split('|');
    
    let maxSimilarity = 0;
    
    // Compare with each enrollment step
    storedSteps.forEach(stepEmbedding => {
      let matches = 0;
      const minLength = Math.min(stepEmbedding.length, currentEmbedding.length);
      
      // Character-by-character comparison
      for (let i = 0; i < minLength; i++) {
        if (stepEmbedding[i] === currentEmbedding[i]) {
          matches++;
        }
      }
      
      const similarity = matches / Math.max(stepEmbedding.length, currentEmbedding.length);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    });
    
    // Verification threshold - adjustable based on security needs
    const VERIFICATION_THRESHOLD = 0.15; // 15% similarity required
    
    return {
      isValid: maxSimilarity >= VERIFICATION_THRESHOLD,
      similarity: Math.round(maxSimilarity * 100) / 100,
      threshold: VERIFICATION_THRESHOLD
    };
    
  } catch (error) {
    console.error('Face verification comparison error:', error);
    return {
      isValid: false,
      similarity: 0,
      error: error.message
    };
  }
};

// Face enrollment endpoint
exports.enrollFace = async (req, res) => {
  try {
    console.log('🔵 Face enrollment request received:', {
      rollNumber: req.body.rollNumber,
      hasEmbedding: !!req.body.faceEmbedding,
      stepsCount: req.body.livenessSteps?.length || 0
    });
    
    const { rollNumber, faceEmbedding, verificationHash, livenessSteps, enrollmentTimestamp } = req.body;

    // Validate required fields
    if (!rollNumber || !faceEmbedding) {
      return res.status(400).json({ 
        success: false,
        message: 'Roll number and face embedding are required' 
      });
    }

    // Find student
    const student = await Student.findOne({ rollNumber });
    if (!student) {
      return res.status(404).json({ 
        success: false,
        message: 'Student not found' 
      });
    }

    // Update student record with face data
    student.faceEmbedding = faceEmbedding;
    student.faceVerificationHash = verificationHash;
    student.faceEnrollmentDate = new Date(enrollmentTimestamp || Date.now());
    student.livenessSteps = livenessSteps || [];
    student.faceEnrolled = true;
    
    await student.save();

    console.log('✅ Face enrollment completed for student:', rollNumber);
    
    res.status(200).json({
      success: true,
      message: 'Face enrollment completed successfully',
      data: {
        rollNumber: student.rollNumber,
        enrollmentDate: student.faceEnrollmentDate,
        stepsCompleted: livenessSteps?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ Face enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Face enrollment failed',
      error: error.message
    });
  }
};

// Face verification for attendance
exports.verifyFaceAttendance = async (req, res) => {
  try {
    console.log('🔍 Face verification attendance request:', {
      rollNumber: req.body.rollNumber,
      className: req.body.className,
      hasEmbedding: !!req.body.faceEmbedding
    });
    
    const { rollNumber, faceEmbedding, className, latitude, longitude, beaconProximity, classCode } = req.body;

    // Validate required fields
    if (!rollNumber || !faceEmbedding || !className || !latitude || !longitude || !classCode) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields for face verification attendance' 
      });
    }

    // Verify student exists and has face enrolled
    const student = await Student.findOne({ rollNumber });
    if (!student) {
      return res.status(404).json({ 
        success: false,
        message: 'Student not found' 
      });
    }

    if (!student.faceEnrolled || !student.faceEmbedding) {
      return res.status(400).json({ 
        success: false,
        message: 'Face enrollment required before using face verification' 
      });
    }

    // Get class details
    const classDetails = await CreateClass.findOne({ classCode });
    if (!classDetails) {
      return res.status(404).json({ 
        success: false,
        message: 'Class not found' 
      });
    }

    // Verify face embedding
    const verificationResult = verifyFaceEmbedding(student.faceEmbedding, faceEmbedding);
    
    if (!verificationResult.isValid) {
      console.warn('⚠️ Face verification failed:', {
        similarity: verificationResult.similarity,
        threshold: verificationResult.threshold
      });
      return res.status(403).json({ 
        success: false,
        message: 'Face verification failed. Please try again or use manual check-in.',
        similarity: verificationResult.similarity,
        required: verificationResult.threshold
      });
    }

    console.log('✅ Face verification successful:', {
      similarity: verificationResult.similarity,
      threshold: verificationResult.threshold
    });

    // Proceed with location and beacon validation
    const geoData = await AddClass.findOne({ className: new RegExp(`^${className}$`, 'i') });
    if (!geoData) {
      return res.status(404).json({ 
        success: false,
        message: 'Class location data not found' 
      });
    }

    // Location validation
    const userLocation = { latitude, longitude };
    const classLocation = { latitude: geoData.latitude, longitude: geoData.longitude };
    const distance = haversine(userLocation, classLocation);

    if (distance > geoData.radius) {
      return res.status(403).json({ 
        success: false,
        message: 'You are not within the class area',
        distance: Math.round(distance),
        allowedRadius: geoData.radius
      });
    }

    // Beacon validation (if configured)
    const expectedBeaconId = geoData?.beaconId ? geoData.beaconId.trim().toLowerCase() : null;
    const receivedBeaconId = beaconProximity?.beaconId ? beaconProximity.beaconId.trim().toLowerCase() : null;

    if (expectedBeaconId && (!receivedBeaconId || receivedBeaconId !== expectedBeaconId)) {
      return res.status(403).json({ 
        success: false,
        message: 'Required beacon not detected or out of range',
        expectedBeaconId: geoData?.beaconId,
        receivedBeaconId: beaconProximity?.beaconId
      });
    }

    // Time validation
    const now = moment().tz('Asia/Kolkata');
    const classDate = moment.tz(`${classDetails.date} ${classDetails.startTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
    const classEndDate = moment.tz(`${classDetails.date} ${classDetails.endTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
    const attendanceWindowEnd = moment(classDate).add(15, 'minutes');

    if (now.isAfter(classEndDate)) {
      return res.status(403).json({ 
        success: false,
        message: 'Class has already ended' 
      });
    }

    // Check existing attendance
    const existingAttendance = await Attendance.findOne({ 
      rollNumber,
      className: classDetails.className,
      subject: classDetails.subject,
      time: {
        $gte: moment(classDate).startOf('day').toDate(),
        $lt: moment(classDate).endOf('day').toDate()
      }
    });

    if (existingAttendance && existingAttendance.status === 'Present') {
      return res.status(400).json({ 
        success: false,
        message: 'Attendance already marked for this class' 
      });
    }

    // Prepare attendance data
    const attendanceData = {
      rollNumber,
      classId: classDetails._id,
      className: classDetails.className,
      subject: classDetails.subject,
      classCode: classDetails.classCode,
      status: 'Present',
      time: now.toDate(),
      verificationMethod: 'face',
      faceVerificationScore: verificationResult.similarity
    };

    // Check if late submission
    if (now.isAfter(attendanceWindowEnd)) {
      attendanceData.lateSubmission = true;
    }

    let attendance;
    if (existingAttendance) {
      // Update existing absent record
      Object.assign(existingAttendance, attendanceData);
      existingAttendance.autoMarked = false;
      attendance = await existingAttendance.save();
    } else {
      // Create new attendance record
      attendance = new Attendance(attendanceData);
      await attendance.save();
    }

    console.log('✅ Face verification attendance marked successfully:', {
      rollNumber,
      className: classDetails.className,
      similarity: verificationResult.similarity,
      late: attendanceData.lateSubmission || false
    });

    res.status(200).json({
      success: true,
      message: `Attendance marked successfully using face verification${attendanceData.lateSubmission ? ' (Late)' : ''}`,
      data: {
        className: classDetails.className,
        subject: classDetails.subject,
        verificationScore: verificationResult.similarity,
        timestamp: attendance.time,
        lateSubmission: attendanceData.lateSubmission || false
      }
    });

  } catch (error) {
    console.error('❌ Face verification attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Face verification attendance failed',
      error: error.message
    });
  }
};

// Fetch class notifications for a student
exports.fetchNotifications = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const serverTime = moment().tz('Asia/Kolkata');
    const formattedDate = serverTime.format('YYYY-MM-DD');

    // Fetch student details
    const student = await Student.findOne({ rollNumber });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Fetch classes for today
    const classes = await CreateClass.find({
      year: student.year.toString(),
      branch: student.department,
      date: formattedDate
    }).sort({ startTime: 1 });

    // Process notifications with precise time calculation
    const notifications = await Promise.all(classes.map(async (classInfo) => {
      // Check for absent students when fetching notifications
      await markAbsentStudents(classInfo);

      const classDate = moment.tz(`${classInfo.date} ${classInfo.startTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
      const classEndDate = moment.tz(`${classInfo.date} ${classInfo.endTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
      const attendanceWindowEnd = moment(classDate).add(15, 'minutes');

      // Check existing attendance
      const existingAttendance = await Attendance.findOne({
        rollNumber,
        className: classInfo.className,
        subject: classInfo.subject,
        time: {
          $gte: moment(classDate).startOf('day').toDate(),
          $lt: moment(classDate).endOf('day').toDate()
        }
      });

      // Calculate time differences
      const minutesUntilStart = classDate.diff(serverTime, 'minutes');
      const minutesFromStart = serverTime.diff(classDate, 'minutes');
      const isEnded = serverTime.isAfter(classEndDate);
      const isAttendanceWindowClosed = serverTime.isAfter(attendanceWindowEnd);

      // Determine status
      let status;
      if (existingAttendance) {
        status = existingAttendance.status === 'Present' ? 'marked' : 'absent';
      } else if (isAttendanceWindowClosed) {
        status = 'absent';
      } else if (minutesFromStart >= 0 && minutesFromStart <= 15) {
        status = 'active';
      } else if (minutesUntilStart <= 5) {
        status = 'starting_soon';
      } else if (minutesUntilStart > 5) {
        status = 'upcoming';
      } else {
        status = 'absent';
      }

      return {
        className: classInfo.className,
        subject: classInfo.subject,
        teacherName: classInfo.teacherName,
        date: classInfo.date,
        startTime: classInfo.startTime,
        endTime: classInfo.endTime,
        day: classInfo.day,
        classCode: classInfo.classCode,
        status,
        minutesUntilStart: Math.max(0, minutesUntilStart),
        minutesRemaining: status === 'active' ? Math.max(0, 15 - minutesFromStart) : 0,
        attendanceId: existingAttendance?._id,
        canMarkLate: status === 'absent' && !isEnded,
        faceEnrolled: student.faceEnrolled || false,
        verificationMethod: existingAttendance?.verificationMethod || null
      };
    }));

    // Filter active notifications
    const activeNotifications = notifications.filter(n => 
      n.status !== 'expired' && (n.status !== 'absent' || n.canMarkLate)
    );

    res.status(200).json({ 
      notifications: activeNotifications,
      serverTime: serverTime.toISOString(),
      studentInfo: {
        rollNumber: student.rollNumber,
        faceEnrolled: student.faceEnrolled || false,
        faceEnrollmentDate: student.faceEnrollmentDate || null
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
};

// Submit attendance (updated to handle face verification and manual attendance)
exports.submitAttendance = async (req, res) => {
  try {
    console.log('📡 Received attendance submission request:', {
      rollNumber: req.body.rollNumber,
      className: req.body.className,
      useFaceVerification: req.body.useFaceVerification
    });
    
    const { rollNumber, className, latitude, longitude, beaconProximity, classCode, useFaceVerification, faceEmbedding } = req.body;

    // If face verification is requested, delegate to face verification endpoint
    if (useFaceVerification && faceEmbedding) {
      return exports.verifyFaceAttendance(req, res);
    }

    // Continue with regular manual attendance flow
    const student = await Student.findOne({ rollNumber });
    if (!student) {
      console.error("❌ Student not found:", rollNumber);
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get current time
    const now = moment().tz('Asia/Kolkata');
    const today = now.format('YYYY-MM-DD');

    // Find the specific class for today
    const classDetails = await CreateClass.findOne({ classCode });
    if (!classDetails) {
      console.error("❌ No matching class found:", { classCode, today });
      return res.status(404).json({ message: 'No matching class found for today' });
    }

    // Fetch geofencing and beacon data
    const geoData = await AddClass.findOne({ className: new RegExp(`^${className}$`, 'i') });
    if (!geoData) {
      console.error("❌ Class geolocation data not found:", className);
      return res.status(404).json({ message: 'Class location data not found' });
    }

    // VALIDATION 1: Check if student is within geofence
    const userLocation = { latitude, longitude };
    const classLocation = { latitude: geoData.latitude, longitude: geoData.longitude };
    const distance = haversine(userLocation, classLocation);

    if (distance > geoData.radius) {
      console.warn("⚠️ Student is OUTSIDE the allowed geofence.");
      return res.status(403).json({ 
        message: 'You are not within the class area', 
        distance: Math.round(distance), 
        allowedRadius: geoData.radius 
      });
    }

    // VALIDATION 2: Check beacon proximity (if configured)
    const expectedBeaconId = geoData?.beaconId ? geoData.beaconId.trim().toLowerCase() : null;
    const receivedBeaconId = beaconProximity?.beaconId ? beaconProximity.beaconId.trim().toLowerCase() : null;

    if (expectedBeaconId) {
      if (!receivedBeaconId || receivedBeaconId !== expectedBeaconId) {
        console.warn("⚠️ Beacon ID mismatch or not detected.");
        return res.status(403).json({ 
          message: 'Required beacon not detected or out of range', 
          expectedBeaconId: geoData?.beaconId,
          receivedBeaconId: beaconProximity?.beaconId
        });
      }
    }

    // VALIDATION 3: Verify class code
    if (classCode !== classDetails.classCode) {
      console.warn("⚠️ Invalid class code provided.");
      return res.status(403).json({
        message: 'Invalid class code provided',
        expected: classDetails.classCode
      });
    }

    // Calculate class timings
    const classDate = moment.tz(`${classDetails.date} ${classDetails.startTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
    const attendanceWindowEnd = moment(classDate).add(15, 'minutes');
    const classEndDate = moment.tz(`${classDetails.date} ${classDetails.endTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');

    // Check if class has ended
    if (now.isAfter(classEndDate)) {
      console.warn("⚠️ Class has already ended.");
      return res.status(403).json({ message: 'Class has already ended' });
    }

    // Check existing attendance
    const existingAttendance = await Attendance.findOne({ 
      rollNumber,
      className: classDetails.className,
      subject: classDetails.subject,
      time: {
        $gte: moment(classDate).startOf('day').toDate(),
        $lt: moment(classDate).endOf('day').toDate()
      }
    });

    // Handle already marked attendance
    if (existingAttendance) {
      if (existingAttendance.status === 'Present') {
        console.warn("⚠️ Attendance already submitted for this class.");
        return res.status(400).json({ message: 'Attendance already submitted for this class' });
      }
      // Allow updating from Absent to Present if within class time
      if (existingAttendance.status === 'Absent' && now.isBefore(classEndDate)) {
        existingAttendance.status = 'Present';
        existingAttendance.time = now.toDate();
        existingAttendance.autoMarked = false;
        existingAttendance.verificationMethod = 'manual';
        await existingAttendance.save();
        console.log("✅ Updated absent to present attendance!");
        return res.status(200).json({
          message: 'Late attendance submitted successfully',
          details: { className: classDetails.className, subject: classDetails.subject }
        });
      }
    }

    // Prepare attendance data
    const attendanceData = {
      rollNumber,
      classId: classDetails._id,
      className: classDetails.className,
      subject: classDetails.subject,
      classCode: classDetails.classCode,
      status: 'Present',
      time: now.toDate(),
      verificationMethod: 'manual'
    };

    // Check if late submission
    if (now.isAfter(attendanceWindowEnd)) {
      attendanceData.lateSubmission = true;
      console.log("⚠️ Attendance submitted after window but during class time - marking as late");
    }

    // Create attendance record
    const attendance = new Attendance(attendanceData);
    await attendance.save();
    
    console.log("✅ Manual attendance marked successfully!");

    return res.status(200).json({
      message: `Attendance submitted successfully${attendanceData.lateSubmission ? ' (Late)' : ''}`,
      details: { 
        className: classDetails.className, 
        subject: classDetails.subject,
        verificationMethod: 'manual',
        lateSubmission: attendanceData.lateSubmission || false
      }
    });

  } catch (error) {
    console.error("❌ Error submitting attendance:", error);
    return res.status(500).json({ message: 'Error submitting attendance', error: error.message });
  }
};

// Get student attendance history (updated with face verification info)
exports.getAttendanceHistory = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    
    const student = await Student.findOne({ rollNumber });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const attendanceHistory = await Attendance.find({ rollNumber })
      .sort({ time: -1 })
      .lean();

    const formattedHistory = attendanceHistory.map(record => ({
      _id: record._id,
      className: record.className,
      subject: record.subject,
      status: record.status,
      date: new Date(record.time).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      time: new Date(record.time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      lateSubmission: record.lateSubmission || false,
      autoMarked: record.autoMarked || false,
      verificationMethod: record.verificationMethod || 'manual',
      faceVerificationScore: record.faceVerificationScore || null
    }));

    // Calculate attendance statistics
    const totalClasses = attendanceHistory.length;
    const presentClasses = attendanceHistory.filter(record => record.status === 'Present').length;
    const absentClasses = attendanceHistory.filter(record => record.status === 'Absent').length;
    const lateSubmissions = attendanceHistory.filter(record => record.lateSubmission).length;
    const faceVerifications = attendanceHistory.filter(record => record.verificationMethod === 'face').length;
    
    const attendancePercentage = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;

    res.status(200).json({ 
      success: true,
      history: formattedHistory,
      statistics: {
        totalClasses,
        presentClasses,
        absentClasses,
        lateSubmissions,
        faceVerifications,
        attendancePercentage
      },
      studentInfo: {
        rollNumber: student.rollNumber,
        faceEnrolled: student.faceEnrolled || false,
        faceEnrollmentDate: student.faceEnrollmentDate || null
      }
    });
  } catch (error) {
    console.error('Error fetching attendance history:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching attendance history',
      error: error.message 
    });
  }
};

// Get face enrollment status
exports.getFaceEnrollmentStatus = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    
    const student = await Student.findOne({ rollNumber });
    if (!student) {
      return res.status(404).json({ 
        success: false,
        message: 'Student not found' 
      });
    }

    res.status(200).json({
      success: true,
      faceEnrolled: student.faceEnrolled || false,
      enrollmentDate: student.faceEnrollmentDate || null,
      stepsCompleted: student.livenessSteps?.length || 0
    });
  } catch (error) {
    console.error('Error fetching face enrollment status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching face enrollment status',
      error: error.message
    });
  }
};

// Reset face enrollment (for testing or if student wants to re-enroll)
exports.resetFaceEnrollment = async (req, res) => {
  try {
    const { rollNumber } = req.body;
    
    const student = await Student.findOne({ rollNumber });
    if (!student) {
      return res.status(404).json({ 
        success: false,
        message: 'Student not found' 
      });
    }

    // Reset face enrollment data
    student.faceEmbedding = null;
    student.faceVerificationHash = null;
    student.faceEnrollmentDate = null;
    student.livenessSteps = [];
    student.faceEnrolled = false;
    
    await student.save();

    console.log('✅ Face enrollment reset for student:', rollNumber);
    
    res.status(200).json({
      success: true,
      message: 'Face enrollment reset successfully'
    });

  } catch (error) {
    console.error('❌ Error resetting face enrollment:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting face enrollment',
      error: error.message
    });
  }
};
