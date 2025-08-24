// controllers/studentController.js - FIXED VERSION

const AddClass = require('../models/AddClass');
const CreateClass = require('../models/CreateClass');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const haversine = require('haversine-distance');
const moment = require('moment-timezone');

/* =========================
   Helpers (Time + Class)
========================= */
const TZ = 'Asia/Kolkata';
const getClassMoments = (classDetails) => {
  const classDate = moment.tz(`${classDetails.date} ${classDetails.startTime}`, 'YYYY-MM-DD HH:mm', TZ);
  const classEndDate = moment.tz(`${classDetails.date} ${classDetails.endTime}`, 'YYYY-MM-DD HH:mm', TZ);
  const attendanceWindowEnd = moment(classDate).add(15, 'minutes');
  return { classDate, classEndDate, attendanceWindowEnd };
};

/* =========================
   Auto Absent Marker
========================= */
const markAbsentStudents = async (classDetails) => {
  try {
    const todayStart = moment().tz(TZ).startOf('day');
    const todayEnd = moment(todayStart).endOf('day');
    const { attendanceWindowEnd } = getClassMoments(classDetails);

    if (moment().tz(TZ).isAfter(attendanceWindowEnd)) {
      const students = await Student.find({
        year: classDetails.year.toString(),
        department: classDetails.branch,
      });

      for (const student of students) {
        const existingAttendance = await Attendance.findOne({
          rollNumber: student.rollNumber,
          className: classDetails.className,
          subject: classDetails.subject,
          time: { $gte: todayStart.toDate(), $lt: todayEnd.toDate() },
        });

        if (!existingAttendance) {
          await new Attendance({
            rollNumber: student.rollNumber,
            classId: classDetails._id,
            className: classDetails.className,
            subject: classDetails.subject,
            classCode: classDetails.classCode,
            status: 'Absent',
            time: attendanceWindowEnd.toDate(),
            autoMarked: true,
          }).save();
        }
      }
    }
  } catch (error) {
    console.error('Error in markAbsentStudents:', error);
  }
};

/* =========================
   Face Verification Utils
========================= */

// Euclidean distance for 128-d numeric descriptors
const calculateEuclideanDistance = (desc1, desc2) => {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) return 1;
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) sum += Math.pow(desc1[i] - desc2[i], 2);
  return Math.sqrt(sum);
};

// Cosine similarity for better face matching
const calculateCosineSimilarity = (desc1, desc2) => {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < desc1.length; i++) {
    dotProduct += desc1[i] * desc2[i];
    normA += Math.pow(desc1[i], 2);
    normB += Math.pow(desc2[i], 2);
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Verify numeric descriptors (preferred) - FIXED: Using cosine similarity
const verifyFaceDescriptor = (storedDescriptors, currentDescriptor, threshold = 0.6) => {
  try {
    if (!storedDescriptors || !currentDescriptor) {
      return { isValid: false, similarity: 0, confidence: 0, threshold, method: 'descriptor', error: 'Missing descriptors' };
    }

    const storedDescs = Array.isArray(storedDescriptors) && Array.isArray(storedDescriptors[0]) 
      ? storedDescriptors 
      : [storedDescriptors];
    
    let maxSimilarity = 0;

    for (const desc of storedDescs) {
      if (!desc || !Array.isArray(desc) || desc.length !== 128) continue;
      
      const similarity = calculateCosineSimilarity(desc, currentDescriptor);
      if (similarity > maxSimilarity) maxSimilarity = similarity;
    }

    const isValid = maxSimilarity >= threshold;
    const confidence = Math.max(0, Math.round(maxSimilarity * 100)); // 0-100

    return { 
      isValid, 
      similarity: Math.round(maxSimilarity * 1000) / 1000, 
      confidence, 
      threshold, 
      method: 'descriptor' 
    };
  } catch (error) {
    console.error('Face verification (descriptor) error:', error);
    return { isValid: false, similarity: 0, confidence: 0, threshold, method: 'descriptor', error: error.message };
  }
};

// Back-compat "string embedding" similarity (max char match ratio)
const verifyFaceEmbedding = (storedEmbedding, currentEmbedding, threshold = 0.15) => {
  try {
    if (!storedEmbedding || !currentEmbedding) {
      return { isValid: false, similarity: 0, confidence: 0, threshold, method: 'embedding', error: 'Missing embeddings' };
    }

    const storedSteps = String(storedEmbedding).split('|');
    let maxSimilarity = 0;

    for (const stepEmbedding of storedSteps) {
      let matches = 0;
      const minLength = Math.min(stepEmbedding.length, currentEmbedding.length);
      for (let i = 0; i < minLength; i++) {
        if (stepEmbedding[i] === currentEmbedding[i]) matches++;
      }
      const similarity = matches / Math.max(stepEmbedding.length, currentEmbedding.length, 1);
      if (similarity > maxSimilarity) maxSimilarity = similarity;
    }

    const isValid = maxSimilarity >= threshold;
    const confidence = Math.round(maxSimilarity * 100);

    return {
      isValid,
      similarity: Math.round(maxSimilarity * 100) / 100,
      confidence,
      threshold,
      method: 'embedding',
    };
  } catch (error) {
    console.error('Face verification (embedding) error:', error);
    return { isValid: false, similarity: 0, confidence: 0, threshold, method: 'embedding', error: error.message };
  }
};

// Unified verify that supports both storage formats
const unifiedVerifyFace = (student, body) => {
  try {
    // 1) Numeric descriptors preferred
    if (student?.faceDescriptors?.length && Array.isArray(body?.faceDescriptor)) {
      return verifyFaceDescriptor(student.faceDescriptors, body.faceDescriptor, 0.55); // Lower threshold for better UX
    }
    
    // 2) Back-compat string embeddings
    if (student?.faceEmbedding && body?.faceEmbedding) {
      return verifyFaceEmbedding(student.faceEmbedding, body.faceEmbedding, 0.12); // Lower threshold
    }
    
    // 3) Error cases
    if (student?.faceDescriptors?.length) {
      return { isValid: false, confidence: 0, method: 'descriptor', error: 'Current face descriptor missing' };
    }
    
    if (student?.faceEmbedding) {
      return { isValid: false, confidence: 0, method: 'embedding', error: 'Current face embedding missing' };
    }
    
    return { isValid: false, confidence: 0, error: 'No enrolled face data found' };
  } catch (error) {
    console.error('Unified face verification error:', error);
    return { isValid: false, confidence: 0, error: error.message };
  }
};

/* =========================
   Controllers
========================= */

exports.enrollFace = async (req, res) => {
  try {
    const {
      rollNumber,
      faceDescriptors,
      detectionData,
      faceEmbedding,
      verificationHash,
      livenessSteps,
      enrollmentTimestamp,
    } = req.body;

    if (!rollNumber) {
      return res.status(400).json({ success: false, message: 'Roll number is required' });
    }

    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Save numeric descriptors if provided and valid
    let descriptorCount = 0;
    if (Array.isArray(faceDescriptors) && faceDescriptors.length > 0) {
      const validDescriptors = faceDescriptors.filter(
        (desc) => Array.isArray(desc) && desc.length === 128 && desc.every((v) => typeof v === 'number')
      );
      
      if (validDescriptors.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid face descriptors provided' });
      }
      
      student.faceDescriptors = validDescriptors;
      descriptorCount = validDescriptors.length;
      student.faceDetectionData = detectionData || {};
    }

    // Save back-compat embedding if provided
    if (faceEmbedding) {
      student.faceEmbedding = String(faceEmbedding);
      student.faceVerificationHash = verificationHash || null;
      student.livenessSteps = Array.isArray(livenessSteps) ? livenessSteps : student.livenessSteps || [];
    }

    if (!descriptorCount && !faceEmbedding) {
      return res.status(400).json({
        success: false,
        message: 'Provide either faceDescriptors (preferred) or faceEmbedding',
      });
    }

    student.faceEnrollmentDate = new Date(enrollmentTimestamp || Date.now());
    student.faceEnrolled = true;
    await student.save();

    res.status(200).json({
      success: true,
      message: 'Face enrollment completed successfully',
      data: {
        rollNumber: student.rollNumber,
        enrollmentDate: student.faceEnrollmentDate,
        descriptorCount,
        stepsCompleted: student.livenessSteps?.length || 0,
      },
    });
  } catch (error) {
    console.error('Face enrollment error:', error);
    res.status(500).json({ success: false, message: 'Face enrollment failed', error: error.message });
  }
};

exports.verifyFaceAttendance = async (req, res) => {
  try {
    const {
      rollNumber,
      className,
      latitude,
      longitude,
      beaconProximity,
      classCode,
      faceDescriptor,
      faceEmbedding,
    } = req.body;

    // Field checks
    if (!rollNumber || !className || !latitude || !longitude || !classCode) {
      return res.status(400).json({ success: false, message: 'Missing required fields for verification' });
    }
    
    if (!faceDescriptor && !faceEmbedding) {
      return res.status(400).json({ success: false, message: 'Provide faceDescriptor or faceEmbedding' });
    }

    // Load records
    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (!student.faceEnrolled || (!student.faceDescriptors && !student.faceEmbedding)) {
      return res.status(400).json({ success: false, message: 'Face enrollment required before verification' });
    }

    const classDetails = await CreateClass.findOne({ classCode });
    if (!classDetails) return res.status(404).json({ success: false, message: 'Class not found' });

    // Face verification
    const verification = unifiedVerifyFace(student, { faceDescriptor, faceEmbedding });
    
    if (!verification.isValid) {
      return res.status(403).json({
        success: false,
        message: verification.method === 'descriptor'
          ? `Face verification failed. Confidence: ${verification.confidence}% (required ~55%+).`
          : 'Face verification failed. Please try again or use manual check-in.',
        confidence: verification.confidence,
        method: verification.method,
        threshold: verification.threshold,
        error: verification.error,
      });
    }

    // Location + beacon checks
    const geoData = await AddClass.findOne({ className: new RegExp(`^${className}$`, 'i') });
    if (!geoData) return res.status(404).json({ success: false, message: 'Class location data not found' });

    const distance = haversine(
      { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
      { latitude: geoData.latitude, longitude: geoData.longitude }
    );
    
    if (distance > geoData.radius) {
      return res.status(403).json({
        success: false,
        message: 'You are not within the class area',
        distance: Math.round(distance),
        allowedRadius: geoData.radius,
      });
    }

    const expectedBeaconId = geoData?.beaconId?.trim()?.toLowerCase();
    const receivedBeaconId = beaconProximity?.beaconId?.trim()?.toLowerCase();
    
    if (expectedBeaconId && receivedBeaconId !== expectedBeaconId) {
      return res.status(403).json({
        success: false,
        message: 'Required beacon not detected',
        expected: geoData.beaconId,
        received: beaconProximity?.beaconId,
      });
    }

    // Time checks
    const now = moment().tz(TZ);
    const { classDate, classEndDate, attendanceWindowEnd } = getClassMoments(classDetails);
    
    if (now.isAfter(classEndDate)) {
      return res.status(403).json({ success: false, message: 'Class has ended' });
    }

    // Existing attendance (per class day)
    const existingAttendance = await Attendance.findOne({
      rollNumber,
      className: classDetails.className,
      subject: classDetails.subject,
      time: {
        $gte: moment(classDate).startOf('day').toDate(),
        $lt: moment(classDate).endOf('day').toDate(),
      },
    });

    if (existingAttendance && existingAttendance.status === 'Present') {
      return res.status(400).json({ success: false, message: 'Attendance already marked' });
    }

    // Mark as present (update absent if auto-marked)
    const attendanceData = {
      rollNumber,
      classId: classDetails._id,
      className: classDetails.className,
      subject: classDetails.subject,
      classCode: classDetails.classCode,
      status: 'Present',
      time: now.toDate(),
      verificationMethod: 'face',
      faceConfidence: verification.confidence,
      faceVerificationScore: verification.confidence,
      verificationType: verification.method,
    };

    if (now.isAfter(attendanceWindowEnd)) {
      attendanceData.lateSubmission = true;
    }

    let attendance;
    if (existingAttendance) {
      Object.assign(existingAttendance, attendanceData);
      existingAttendance.autoMarked = false;
      attendance = await existingAttendance.save();
    } else {
      attendance = await new Attendance(attendanceData).save();
    }

    res.status(200).json({
      success: true,
      message: `Attendance marked successfully${attendanceData.lateSubmission ? ' (Late)' : ''}`,
      data: {
        className: classDetails.className,
        subject: classDetails.subject,
        confidence: verification.confidence,
        method: verification.method,
        lateSubmission: attendanceData.lateSubmission || false,
      },
    });
  } catch (error) {
    console.error('Face verification attendance error:', error);
    res.status(500).json({ success: false, message: 'Verification failed', error: error.message });
  }
};

exports.fetchNotifications = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const serverTime = moment().tz(TZ);

    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const classes = await CreateClass.find({
      year: student.year.toString(),
      branch: student.department,
      date: serverTime.format('YYYY-MM-DD'),
    }).sort({ startTime: 1 });

    const notifications = await Promise.all(
      classes.map(async (classInfo) => {
        await markAbsentStudents(classInfo);

        const { classDate, classEndDate, attendanceWindowEnd } = getClassMoments(classInfo);
        const existingAttendance = await Attendance.findOne({
          rollNumber,
          className: classInfo.className,
          subject: classInfo.subject,
          time: {
            $gte: moment(classDate).startOf('day').toDate(),
            $lt: moment(classDate).endOf('day').toDate(),
          },
        });

        const minutesUntilStart = classDate.diff(serverTime, 'minutes');
        const minutesFromStart = serverTime.diff(classDate, 'minutes');
        const isEnded = serverTime.isAfter(classEndDate);
        const isWindowClosed = serverTime.isAfter(attendanceWindowEnd);

        let status = 'upcoming';
        if (existingAttendance) {
          status = existingAttendance.status === 'Present' ? 'marked' : 'absent';
        } else if (isWindowClosed) {
          status = 'absent';
        } else if (minutesFromStart >= 0 && minutesFromStart <= 15) {
          status = 'active';
        } else if (minutesUntilStart <= 5) {
          status = 'starting_soon';
        }

        return {
          className: classInfo.className,
          subject: classInfo.subject,
          teacherName: classInfo.teacherName,
          date: classInfo.date,
          startTime: classInfo.startTime,
          endTime: classInfo.endTime,
          classCode: classInfo.classCode,
          status,
          minutesUntilStart: Math.max(0, minutesUntilStart),
          minutesRemaining: status === 'active' ? Math.max(0, 15 - minutesFromStart) : 0,
          canMarkLate: status === 'absent' && !isEnded,
          faceEnrolled: student.faceEnrolled || false,
          verificationMethod: existingAttendance?.verificationMethod || null,
        };
      })
    );

    res.status(200).json({
      notifications: notifications.filter((n) => n.status !== 'expired' && (n.status !== 'absent' || n.canMarkLate)),
      serverTime: serverTime.toISOString(),
      studentInfo: {
        rollNumber: student.rollNumber,
        faceEnrolled: student.faceEnrolled || false,
        faceEnrollmentDate: student.faceEnrollmentDate || null,
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

exports.submitAttendance = async (req, res) => {
  try {
    const {
      rollNumber,
      className,
      latitude,
      longitude,
      beaconProximity,
      classCode,
      useFaceVerification,
      faceDescriptor,
      faceEmbedding,
    } = req.body;

    // If using face verification, route to that handler
    if (useFaceVerification && (faceDescriptor || faceEmbedding)) {
      return exports.verifyFaceAttendance(req, res);
    }

    // Manual flow
    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const classDetails = await CreateClass.findOne({ classCode });
    if (!classDetails) return res.status(404).json({ message: 'Class not found' });

    const geoData = await AddClass.findOne({ className: new RegExp(`^${className}$`, 'i') });
    if (!geoData) return res.status(404).json({ message: 'Class location not found' });

    const distance = haversine(
      { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
      { latitude: geoData.latitude, longitude: geoData.longitude }
    );
    
    if (distance > geoData.radius) {
      return res.status(403).json({ message: 'Not within class area', distance: Math.round(distance) });
    }

    const expectedBeaconId = geoData?.beaconId?.trim()?.toLowerCase();
    const receivedBeaconId = beaconProximity?.beaconId?.trim()?.toLowerCase();
    
    if (expectedBeaconId && receivedBeaconId !== expectedBeaconId) {
      return res.status(403).json({ 
        message: 'Required beacon not detected', 
        expected: geoData.beaconId,
        received: beaconProximity?.beaconId 
      });
    }

    const now = moment().tz(TZ);
    const { classDate, classEndDate, attendanceWindowEnd } = getClassMoments(classDetails);

    if (now.isAfter(classEndDate)) {
      return res.status(403).json({ message: 'Class has ended' });
    }

    const existingAttendance = await Attendance.findOne({
      rollNumber,
      className: classDetails.className,
      subject: classDetails.subject,
      time: {
        $gte: moment(classDate).startOf('day').toDate(),
        $lt: moment(classDate).endOf('day').toDate(),
      },
    });

    if (existingAttendance?.status === 'Present') {
      return res.status(400).json({ message: 'Attendance already marked' });
    }

    // If previously auto-marked Absent and class not ended, flip to Present
    if (existingAttendance && existingAttendance.status === 'Absent' && now.isBefore(classEndDate)) {
      existingAttendance.status = 'Present';
      existingAttendance.time = now.toDate();
      existingAttendance.autoMarked = false;
      existingAttendance.verificationMethod = 'manual';
      
      if (now.isAfter(attendanceWindowEnd)) {
        existingAttendance.lateSubmission = true;
      }
      
      await existingAttendance.save();
      
      return res.status(200).json({
        message: `Attendance submitted${existingAttendance.lateSubmission ? ' (Late)' : ''}`,
        details: { 
          className: classDetails.className, 
          subject: classDetails.subject, 
          verificationMethod: 'manual' 
        },
      });
    }

    // Fresh manual record
    const attendanceData = {
      rollNumber,
      classId: classDetails._id,
      className: classDetails.className,
      subject: classDetails.subject,
      classCode: classDetails.classCode,
      status: 'Present',
      time: now.toDate(),
      verificationMethod: 'manual',
    };
    
    if (now.isAfter(attendanceWindowEnd)) {
      attendanceData.lateSubmission = true;
    }

    await new Attendance(attendanceData).save();

    res.status(200).json({
      message: `Attendance submitted${attendanceData.lateSubmission ? ' (Late)' : ''}`,
      details: {
        className: classDetails.className,
        subject: classDetails.subject,
        verificationMethod: 'manual',
        lateSubmission: attendanceData.lateSubmission || false,
      },
    });
  } catch (error) {
    console.error('Error submitting attendance:', error);
    res.status(500).json({ message: 'Error submitting attendance', error: error.message });
  }
};

exports.getAttendanceHistory = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const student = await Student.findOne({ rollNumber });
    
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const history = await Attendance.find({ rollNumber }).sort({ time: -1 }).lean();

    const formattedHistory = history.map((record) => ({
      _id: record._id,
      className: record.className,
      subject: record.subject,
      status: record.status,
      date: new Date(record.time).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      time: new Date(record.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      lateSubmission: record.lateSubmission || false,
      autoMarked: record.autoMarked || false,
      verificationMethod: record.verificationMethod || 'manual',
      faceConfidence: record.faceConfidence || record.faceVerificationScore || null,
      faceVerificationScore: record.faceVerificationScore || record.faceConfidence || null,
      verificationType: record.verificationType || null,
    }));

    const stats = {
      totalClasses: history.length,
      presentClasses: history.filter((r) => r.status === 'Present').length,
      absentClasses: history.filter((r) => r.status === 'Absent').length,
      lateSubmissions: history.filter((r) => r.lateSubmission).length,
      faceVerifications: history.filter((r) => r.verificationMethod === 'face').length,
    };
    
    stats.attendancePercentage = stats.totalClasses > 0 
      ? Math.round((stats.presentClasses / stats.totalClasses) * 100) 
      : 0;

    res.status(200).json({
      success: true,
      history: formattedHistory,
      statistics: stats,
      studentInfo: {
        rollNumber: student.rollNumber,
        faceEnrolled: student.faceEnrolled || false,
        faceEnrollmentDate: student.faceEnrollmentDate || null,
      },
    });
  } catch (error) {
    console.error('Error fetching attendance history:', error);
    res.status(500).json({ success: false, message: 'Error fetching history', error: error.message });
  }
};

exports.getFaceEnrollmentStatus = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const student = await Student.findOne({ rollNumber });
    
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.status(200).json({
      success: true,
      faceEnrolled: student.faceEnrolled || false,
      enrollmentDate: student.faceEnrollmentDate || null,
      descriptorCount: Array.isArray(student.faceDescriptors) ? student.faceDescriptors.length : 0,
      stepsCompleted: student.livenessSteps?.length || 0,
      hasEmbedding: Boolean(student.faceEmbedding),
    });
  } catch (error) {
    console.error('Error fetching face enrollment status:', error);
    res.status(500).json({ success: false, message: 'Error fetching status', error: error.message });
  }
};

exports.resetFaceEnrollment = async (req, res) => {
  try {
    const { rollNumber } = req.body;
    const student = await Student.findOne({ rollNumber });
    
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Clear both formats
    student.faceDescriptors = undefined;
    student.faceDetectionData = undefined;
    student.faceEmbedding = undefined;
    student.faceVerificationHash = undefined;
    student.livenessSteps = [];
    student.faceEnrollmentDate = undefined;
    student.faceEnrolled = false;
    
    await student.save();

    res.status(200).json({ success: true, message: 'Face enrollment reset successfully' });
  } catch (error) {
    console.error('Error resetting face enrollment:', error);
    res.status(500).json({ success: false, message: 'Error resetting enrollment', error: error.message });
  }
};

exports.verifyFaceOnly = async (req, res) => {
  try {
    const { rollNumber, faceDescriptor, faceEmbedding } = req.body;

    if (!rollNumber) {
      return res.status(400).json({ success: false, message: 'Roll number is required' });
    }
    
    if (!faceDescriptor && !faceEmbedding) {
      return res.status(400).json({ success: false, message: 'Provide faceDescriptor or faceEmbedding' });
    }

    const student = await Student.findOne({ rollNumber });
    
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (!student.faceEnrolled || (!student.faceDescriptors && !student.faceEmbedding)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Face enrollment required before verification' 
      });
    }

    // Face verification using existing unified function
    const verification = unifiedVerifyFace(student, { faceDescriptor, faceEmbedding });
    
    if (!verification.isValid) {
      return res.status(403).json({
        success: false,
        message: verification.method === 'descriptor'
          ? `Face verification failed. Confidence: ${verification.confidence}% (required ~55%+).`
          : 'Face verification failed. Please try again.',
        confidence: verification.confidence,
        method: verification.method,
        threshold: verification.threshold,
        error: verification.error,
      });
    }

    // Success response
    res.status(200).json({
      success: true,
      message: 'Face verification successful',
      confidence: verification.confidence,
      method: verification.method,
      data: {
        rollNumber: student.rollNumber,
        confidence: verification.confidence,
        method: verification.method,
        similarity: verification.similarity || (1 - (verification.distance || 0))
      }
    });

  } catch (error) {
    console.error('Face-only verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Face verification failed', 
      error: error.message 
    });
  }
};
