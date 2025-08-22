const AddClass = require('../models/AddClass');
const CreateClass = require('../models/CreateClass');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const haversine = require('haversine-distance');
const moment = require('moment-timezone');

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

const verifyFaceEmbedding = (storedEmbedding, currentEmbedding) => {
  try {
    if (!storedEmbedding || !currentEmbedding) return { isValid: false, similarity: 0, error: 'Missing embedding data' };
    const storedSteps = storedEmbedding.split('|');
    let maxSimilarity = 0;
    storedSteps.forEach(stepEmbedding => {
      let matches = 0;
      const minLength = Math.min(stepEmbedding.length, currentEmbedding.length);
      for (let i = 0; i < minLength; i++) if (stepEmbedding[i] === currentEmbedding[i]) matches++;
      const similarity = matches / Math.max(stepEmbedding.length, currentEmbedding.length);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    });
    const VERIFICATION_THRESHOLD = 0.15;
    return { isValid: maxSimilarity >= VERIFICATION_THRESHOLD, similarity: Math.round(maxSimilarity * 100) / 100, threshold: VERIFICATION_THRESHOLD };
  } catch (error) {
    console.error('Face verification comparison error:', error);
    return { isValid: false, similarity: 0, error: error.message };
  }
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
    const now = moment().tz('Asia/Kolkata');
    const classDate = moment.tz(`${classDetails.date} ${classDetails.startTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
    const classEndDate = moment.tz(`${classDetails.date} ${classDetails.endTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
    const attendanceWindowEnd = moment(classDate).add(15, 'minutes');
    if (now.isAfter(classEndDate)) return res.status(403).json({ success: false, message: 'Class has already ended' });
    const existingAttendance = await Attendance.findOne({ rollNumber, className: classDetails.className, subject: classDetails.subject, time: { $gte: moment(classDate).startOf('day').toDate(), $lt: moment(classDate).endOf('day').toDate() } });
    if (existingAttendance && existingAttendance.status === 'Present') return res.status(400).json({ success: false, message: 'Attendance already marked for this class' });
    const attendanceData = { rollNumber, classId: classDetails._id, className: classDetails.className, subject: classDetails.subject, classCode: classDetails.classCode, status: 'Present', time: now.toDate(), verificationMethod: 'face', faceVerificationScore: verificationResult.similarity };
    if (now.isAfter(attendanceWindowEnd)) attendanceData.lateSubmission = true;
    let attendance;
    if (existingAttendance) {
      Object.assign(existingAttendance, attendanceData);
      existingAttendance.autoMarked = false;
      attendance = await existingAttendance.save();
    } else {
      attendance = new Attendance(attendanceData);
      await attendance.save();
    }
    res.status(200).json({ success: true, message: `Attendance marked successfully using face verification${attendanceData.lateSubmission ? ' (Late)' : ''}`, data: { className: classDetails.className, subject: classDetails.subject, verificationScore: verificationResult.similarity, timestamp: attendance.time, lateSubmission: attendanceData.lateSubmission || false } });
  } catch (error) {
    console.error('❌ Face verification attendance error:', error);
    res.status(500).json({ success: false, message: 'Face verification attendance failed', error: error.message });
  }
};

exports.fetchNotifications = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const serverTime = moment().tz('Asia/Kolkata');
    const formattedDate = serverTime.format('YYYY-MM-DD');
    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const classes = await CreateClass.find({ year: student.year.toString(), branch: student.department, date: formattedDate }).sort({ startTime: 1 });
    const notifications = await Promise.all(classes.map(async (classInfo) => {
      await markAbsentStudents(classInfo);
      const classDate = moment.tz(`${classInfo.date} ${classInfo.startTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
      const classEndDate = moment.tz(`${classInfo.date} ${classInfo.endTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
      const attendanceWindowEnd = moment(classDate).add(15, 'minutes');
      const existingAttendance = await Attendance.findOne({ rollNumber, className: classInfo.className, subject: classInfo.subject, time: { $gte: moment(classDate).startOf('day').toDate(), $lt: moment(classDate).endOf('day').toDate() } });
      const minutesUntilStart = classDate.diff(serverTime, 'minutes');
      const minutesFromStart = serverTime.diff(classDate, 'minutes');
      const isEnded = serverTime.isAfter(classEndDate);
      const isAttendanceWindowClosed = serverTime.isAfter(attendanceWindowEnd);
      let status;
      if (existingAttendance) status = existingAttendance.status === 'Present' ? 'marked' : 'absent';
      else if (isAttendanceWindowClosed) status = 'absent';
      else if (minutesFromStart >= 0 && minutesFromStart <= 15) status = 'active';
      else if (minutesUntilStart <= 5) status = 'starting_soon';
      else if (minutesUntilStart > 5) status = 'upcoming';
      else status = 'absent';
      return { className: classInfo.className, subject: classInfo.subject, teacherName: classInfo.teacherName, date: classInfo.date, startTime: classInfo.startTime, endTime: classInfo.endTime, day: classInfo.day, classCode: classInfo.classCode, status, minutesUntilStart: Math.max(0, minutesUntilStart), minutesRemaining: status === 'active' ? Math.max(0, 15 - minutesFromStart) : 0, attendanceId: existingAttendance?._id, canMarkLate: status === 'absent' && !isEnded, faceEnrolled: student.faceEnrolled || false, verificationMethod: existingAttendance?.verificationMethod || null };
    }));
    const activeNotifications = notifications.filter(n => n.status !== 'expired' && (n.status !== 'absent' || n.canMarkLate));
    res.status(200).json({ notifications: activeNotifications, serverTime: serverTime.toISOString(), studentInfo: { rollNumber: student.rollNumber, faceEnrolled: student.faceEnrolled || false, faceEnrollmentDate: student.faceEnrollmentDate || null } });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
};

exports.submitAttendance = async (req, res) => {
  try {
    const { rollNumber, className, latitude, longitude, beaconProximity, classCode, useFaceVerification, faceEmbedding } = req.body;
    if (useFaceVerification && faceEmbedding) return exports.verifyFaceAttendance(req, res);
    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const now = moment().tz('Asia/Kolkata');
    const today = now.format('YYYY-MM-DD');
    const classDetails = await CreateClass.findOne({ classCode });
    if (!classDetails) return res.status(404).json({ message: 'No matching class found for today' });
    const geoData = await AddClass.findOne({ className: new RegExp(`^${className}$`, 'i') });
    if (!geoData) return res.status(404).json({ message: 'Class location data not found' });
    const userLocation = { latitude, longitude };
    const classLocation = { latitude: geoData.latitude, longitude: geoData.longitude };
    const distance = haversine(userLocation, classLocation);
    if (distance > geoData.radius) return res.status(403).json({ message: 'You are not within the class area', distance: Math.round(distance), allowedRadius: geoData.radius });
    const expectedBeaconId = geoData?.beaconId ? geoData.beaconId.trim().toLowerCase() : null;
    const receivedBeaconId = beaconProximity?.beaconId ? beaconProximity.beaconId.trim().toLowerCase() : null;
    if (expectedBeaconId && (!receivedBeaconId || receivedBeaconId !== expectedBeaconId)) return res.status(403).json({ message: 'Required beacon not detected or out of range', expectedBeaconId: geoData?.beaconId, receivedBeaconId: beaconProximity?.beaconId });
    if (classCode !== classDetails.classCode) return res.status(403).json({ message: 'Invalid class code provided', expected: classDetails.classCode });
    const classDate = moment.tz(`${classDetails.date} ${classDetails.startTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
    const attendanceWindowEnd = moment(classDate).add(15, 'minutes');
    const classEndDate = moment.tz(`${classDetails.date} ${classDetails.endTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
    if (now.isAfter(classEndDate)) return res.status(403).json({ message: 'Class has already ended' });
    const existingAttendance = await Attendance.findOne({ rollNumber, className: classDetails.className, subject: classDetails.subject, time: { $gte: moment(classDate).startOf('day').toDate(), $lt: moment(classDate).endOf('day').toDate() } });
    if (existingAttendance) {
      if (existingAttendance.status === 'Present') return res.status(400).json({ message: 'Attendance already submitted for this class' });
      if (existingAttendance.status === 'Absent' && now.isBefore(classEndDate)) {
        existingAttendance.status = 'Present';
        existingAttendance.time = now.toDate();
        existingAttendance.autoMarked = false;
        existingAttendance.verificationMethod = 'manual';
        await existingAttendance.save();
        return res.status(200).json({ message: 'Late attendance submitted successfully', details: { className: classDetails.className, subject: classDetails.subject } });
      }
    }
    const attendanceData = { rollNumber, classId: classDetails._id, className: classDetails.className, subject: classDetails.subject, classCode: classDetails.classCode, status: 'Present', time: now.toDate(), verificationMethod: 'manual' };
    if (now.isAfter(attendanceWindowEnd)) attendanceData.lateSubmission = true;
    const attendance = new Attendance(attendanceData);
    await attendance.save();
    return res.status(200).json({ message: `Attendance submitted successfully${attendanceData.lateSubmission ? ' (Late)' : ''}`, details: { className: classDetails.className, subject: classDetails.subject, verificationMethod: 'manual', lateSubmission: attendanceData.lateSubmission || false } });
  } catch (error) {
    console.error("❌ Error submitting attendance:", error);
    return res.status(500).json({ message: 'Error submitting attendance', error: error.message });
  }
};

exports.getAttendanceHistory = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const attendanceHistory = await Attendance.find({ rollNumber }).sort({ time: -1 }).lean();
    const formattedHistory = attendanceHistory.map(record => ({
      _id: record._id, className: record.className, subject: record.subject, status: record.status,
      date: new Date(record.time).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      time: new Date(record.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      lateSubmission: record.lateSubmission || false, autoMarked: record.autoMarked || false,
      verificationMethod: record.verificationMethod || 'manual', faceVerificationScore: record.faceVerificationScore || null
    }));
    const totalClasses = attendanceHistory.length;
    const presentClasses = attendanceHistory.filter(record => record.status === 'Present').length;
    const absentClasses = attendanceHistory.filter(record => record.status === 'Absent').length;
    const lateSubmissions = attendanceHistory.filter(record => record.lateSubmission).length;
    const faceVerifications = attendanceHistory.filter(record => record.verificationMethod === 'face').length;
    const attendancePercentage = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;
    res.status(200).json({ success: true, history: formattedHistory, statistics: { totalClasses, presentClasses, absentClasses, lateSubmissions, faceVerifications, attendancePercentage }, studentInfo: { rollNumber: student.rollNumber, faceEnrolled: student.faceEnrolled || false, faceEnrollmentDate: student.faceEnrollmentDate || null } });
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
    res.status(200).json({ success: true, message: 'Face enrollment reset successfully' });
  } catch (error) {
    console.error('❌ Error resetting face enrollment:', error);
    res.status(500).json({ success: false, message: 'Error resetting face enrollment', error: error.message });
  }
};
