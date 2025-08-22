const AddClass = require('../models/AddClass');
const CreateClass = require('../models/CreateClass');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const haversine = require('haversine-distance');
const moment = require('moment-timezone');

// Helper function for robust vector comparison (Cosine Similarity)
const calculateVectorSimilarity = (vecA, vecB) => {
  const minLength = Math.min(vecA.length, vecB.length);
  if (minLength === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < minLength; i++) {
    const a = vecA[i] || 0;
    const b = vecB[i] || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Fixed verification logic to handle JSON data
const verifyFaceEmbedding = (storedEmbedding, currentEmbedding) => {
  try {
    if (!storedEmbedding || !currentEmbedding) {
      return { isValid: false, similarity: 0, error: 'Missing embedding data' };
    }
    
    let storedProfile;
    try {
      storedProfile = JSON.parse(storedEmbedding);
    } catch (parseError) {
      console.error('Failed to parse stored face embedding as JSON:', parseError);
      return { isValid: false, similarity: 0, error: 'Stored data is not valid JSON' };
    }
    
    let maxSimilarity = 0;
    const featureVectors = Object.values(storedProfile);
    
    if (featureVectors.length === 0) {
        return { isValid: false, similarity: 0, error: 'No feature vectors found in stored data' };
    }

    featureVectors.forEach(storedVector => {
      const similarity = calculateVectorSimilarity(storedVector, currentEmbedding);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    });
    
    const VERIFICATION_THRESHOLD = 0.8; // Adjusted threshold for cosine similarity (0-1 range)
    return { 
      isValid: maxSimilarity >= VERIFICATION_THRESHOLD, 
      similarity: Math.round(maxSimilarity * 100) / 100, 
      threshold: VERIFICATION_THRESHOLD 
    };
  } catch (error) {
    console.error('Face verification comparison error:', error);
    return { isValid: false, similarity: 0, error: error.message };
  }
};

const markAbsentStudents = async (classDetails) => {
  try {
    const today = moment().tz('Asia/Kolkata').startOf('day');
    const classDate = moment.tz(`${classDetails.date} ${classDetails.startTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
    const attendanceWindowEnd = moment(classDate).add(15, 'minutes');
    if (moment().tz('Asia/Kolkata').isAfter(attendanceWindowEnd)) {
      const students = await Student.find({ year: classDetails.year.toString(), department: classDetails.branch });
      for (const student of students) {
        const existingAttendance = await Attendance.findOne({
          rollNumber: student.rollNumber, className: classDetails.className, subject: classDetails.subject,
          time: { $gte: today.toDate(), $lt: moment(today).endOf('day').toDate() }
        });
        if (!existingAttendance) {
          const absentAttendance = new Attendance({
            rollNumber: student.rollNumber, classId: classDetails._id, className: classDetails.className,
            subject: classDetails.subject, classCode: classDetails.classCode, status: 'Absent',
            time: attendanceWindowEnd.toDate(), autoMarked: true
          });
          await absentAttendance.save();
        }
      }
    }
  } catch (error) { console.error('Error in markAbsentStudents:', error); }
};

exports.enrollFace = async (req, res) => {
  try {
    const { rollNumber, faceEmbedding, verificationHash, livenessSteps, enrollmentTimestamp } = req.body;
    if (!rollNumber || !faceEmbedding) return res.status(400).json({ success: false, message: 'Roll number and face embedding are required' });
    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    student.faceEmbedding = faceEmbedding;
    student.faceVerificationHash = verificationHash;
    student.faceEnrollmentDate = new Date(enrollmentTimestamp || Date.now());
    student.livenessSteps = livenessSteps || [];
    student.faceEnrolled = true;
    await student.save();
    res.status(200).json({ success: true, message: 'Face enrollment completed successfully', data: { rollNumber: student.rollNumber, enrollmentDate: student.faceEnrollmentDate, stepsCompleted: livenessSteps?.length || 0 } });
  } catch (error) {
    console.error('❌ Face enrollment error:', error);
    res.status(500).json({ success: false, message: 'Face enrollment failed', error: error.message });
  }
};

exports.verifyFaceAttendance = async (req, res) => {
  try {
    const { rollNumber, faceEmbedding, className, latitude, longitude, beaconProximity, classCode } = req.body;
    if (!rollNumber || !faceEmbedding || !className || !latitude || !longitude || !classCode) return res.status(400).json({ success: false, message: 'Missing required fields for face verification attendance' });
    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    if (!student.faceEnrolled || !student.faceEmbedding) return res.status(400).json({ success: false, message: 'Face enrollment required before using face verification' });
    const classDetails = await CreateClass.findOne({ classCode });
    if (!classDetails) return res.status(404).json({ success: false, message: 'Class not found' });
    const verificationResult = verifyFaceEmbedding(student.faceEmbedding, faceEmbedding);
    if (!verificationResult.isValid) return res.status(403).json({ success: false, message: 'Face verification failed. Please try again or use manual check-in.', similarity: verificationResult.similarity, required: verificationResult.threshold });
    const geoData = await AddClass.findOne({ className: new RegExp(`^${className}$`, 'i') });
    if (!geoData) return res.status(404).json({ success: false, message: 'Class location data not found' });
    const userLocation = { latitude, longitude };
    const classLocation = { latitude: geoData.latitude, longitude: geoData.longitude };
    const distance = haversine(userLocation, classLocation);
    if (distance > geoData.radius) return res.status(403).json({ success: false, message: 'You are not within the class area', distance: Math.round(distance), allowedRadius: geoData.radius });
    const expectedBeaconId = geoData?.beaconId ? geoData.beaconId.trim().toLowerCase() : null;
    const receivedBeaconId = beaconProximity?.beaconId ? beaconProximity.beaconId.trim().toLowerCase() : null;
    if (expectedBeaconId && (!receivedBeaconId || receivedBeaconId !== expectedBeaconId)) return res.status(403).json({ success: false, message: 'Required beacon not detected or out of range', expectedBeaconId: geoData?.beaconId, receivedBeaconId: beaconProximity?.beaconId });
    const today = moment().tz('Asia/Kolkata').startOf('day');
    const existingAttendance = await Attendance.findOne({
      rollNumber, className: classDetails.className, subject: classDetails.subject, classCode: classDetails.classCode,
      time: { $gte: today.toDate(), $lt: moment(today).endOf('day').toDate() }
    });
    if (existingAttendance) return res.status(409).json({ success: false, message: 'Attendance already marked for this class today.' });
    const newAttendance = new Attendance({
      rollNumber, classId: classDetails._id, className: classDetails.className,
      subject: classDetails.subject, classCode: classDetails.classCode, status: 'Present',
      time: new Date(), verifiedBy: 'Face'
    });
    await newAttendance.save();
    res.status(200).json({ success: true, message: 'Attendance marked successfully via face verification', data: { status: newAttendance.status, time: newAttendance.time, class: newAttendance.className, verifiedBy: newAttendance.verifiedBy } });
  } catch (error) {
    console.error('❌ Face verification attendance error:', error);
    res.status(500).json({ success: false, message: 'Face verification attendance failed', error: error.message });
  }
};

exports.getAttendanceHistory = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const history = await Attendance.find({ rollNumber }).sort({ time: -1 });
    res.status(200).json({ success: true, history });
  } catch (error) {
    console.error('Error fetching attendance history:', error);
    res.status(500).json({ success: false, message: 'Error fetching attendance history', error: error.message });
  }
};

exports.getFaceEnrollmentStatus = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.status(200).json({ success: true, faceEnrolled: student.faceEnrolled || false, enrollmentDate: student.faceEnrollmentDate || null, stepsCompleted: student.livenessSteps?.length || 0 });
  } catch (error) {
    console.error('Error fetching face enrollment status:', error);
    res.status(500).json({ success: false, message: 'Error fetching face enrollment status', error: error.message });
  }
};

exports.resetFaceEnrollment = async (req, res) => {
  try {
    const { rollNumber } = req.body;
    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    student.faceEmbedding = null;
    student.faceVerificationHash = null;
    student.faceEnrollmentDate = null;
    student.livenessSteps = [];
    student.faceEnrolled = false;
    await student.save();
    res.status(200).json({ success: true, message: 'Face enrollment data reset successfully' });
  } catch (error) {
    console.error('Error resetting face enrollment:', error);
    res.status(500).json({ success: false, message: 'Error resetting face enrollment data', error: error.message });
  }
};
