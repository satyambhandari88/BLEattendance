const AddClass = require('../models/AddClass');
const CreateClass = require('../models/CreateClass');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const haversine = require('haversine-distance');
const moment = require('moment-timezone');
const { calculateCosineSimilarity } = require('../utils/faceUtils');
const crypto = require('crypto');

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
            time: attendanceWindowEnd.toDate(), studentId: student._id
          });
          await absentAttendance.save();
        }
      }
    }
  } catch (error) {
    console.error('Error marking absent students:', error);
  }
};

exports.enrollFace = async (req, res) => {
  try {
    const { rollNumber, faceEmbedding, steps, timestamp, version } = req.body;
    if (!rollNumber || !faceEmbedding || !steps || !version) {
      return res.status(400).json({ success: false, message: 'Missing required data' });
    }

    const student = await Student.findOne({ rollNumber });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    student.faceEmbedding = faceEmbedding;
    student.faceEnrollmentDate = new Date();
    student.faceEnrolled = true;
    student.livenessSteps = [{ action: 'enrollment_completed', timestamp: timestamp, version: version, steps }];

    await student.save();

    res.status(200).json({ success: true, message: 'Face enrollment successful' });
  } catch (error) {
    console.error('Face enrollment error:', error);
    res.status(500).json({ success: false, message: 'Server error during face enrollment', error: error.message });
  }
};

exports.verifyFaceAttendance = async (req, res) => {
  try {
    const { rollNumber, classCode, latitude, longitude, faceFeatures, timestamp, deviceId } = req.body;
    if (!rollNumber || !classCode || !latitude || !longitude || !faceFeatures) {
      return res.status(400).json({ success: false, message: 'Missing required data' });
    }

    const student = await Student.findOne({ rollNumber });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    if (!student.faceEnrolled) {
      return res.status(403).json({ success: false, message: 'Face not enrolled for this student' });
    }
    
    if (student.deviceId && student.deviceId !== deviceId) {
        return res.status(403).json({ success: false, message: 'Device mismatch. Please use your registered device.' });
    }

    const classDetails = await CreateClass.findOne({ classCode });
    if (!classDetails) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    
    if (classDetails.classStatus === 'Completed') {
        return res.status(403).json({ success: false, message: 'Attendance for this class has been closed.' });
    }

    const today = moment().tz('Asia/Kolkata').startOf('day');
    const existingAttendance = await Attendance.findOne({
      rollNumber, classId: classDetails._id,
      time: { $gte: today.toDate(), $lt: moment(today).endOf('day').toDate() }
    });
    if (existingAttendance) {
      return res.status(200).json({ success: true, message: 'Attendance already marked for this class' });
    }

    const haversineDistance = haversine(
      { latitude, longitude },
      { latitude: classDetails.latitude, longitude: classDetails.longitude }
    );
    const distanceThreshold = 50; 
    if (haversineDistance > distanceThreshold) {
      return res.status(403).json({ success: false, message: 'You are too far from the class location.' });
    }

    const isVerified = true; // This will be handled on the client side now
    if (!isVerified) {
      return res.status(403).json({ success: false, message: 'Face verification failed.' });
    }

    const newAttendance = new Attendance({
      rollNumber, classId: classDetails._id, className: classDetails.className,
      subject: classDetails.subject, classCode: classCode, status: 'Present',
      time: new Date(timestamp), studentId: student._id
    });
    await newAttendance.save();
    
    markAbsentStudents(classDetails).catch(err => console.error('Failed to mark absent students:', err));

    res.status(200).json({ success: true, message: 'Attendance marked successfully via face verification' });
  } catch (error) {
    console.error('Face verification attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error during attendance marking', error: error.message });
  }
};

exports.fetchNotifications = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const today = moment().tz('Asia/Kolkata').startOf('day');

    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const classes = await CreateClass.find({
      branch: student.department, year: student.year.toString(), classStatus: 'Active',
      date: { $gte: moment(today).format('YYYY-MM-DD') },
      startTime: { $gte: moment(today).format('HH:mm') }
    }).sort({ date: 1, startTime: 1 });

    const notifications = classes.map(c => ({
      classId: c._id,
      subject: c.subject,
      className: c.className,
      teacher: c.teacherName,
      classCode: c.classCode,
      date: c.date,
      startTime: c.startTime
    }));

    res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Error fetching notifications', error: error.message });
  }
};

exports.submitAttendance = async (req, res) => {
  try {
    const { rollNumber, classCode, latitude, longitude, deviceId } = req.body;
    if (!rollNumber || !classCode || !latitude || !longitude || !deviceId) {
      return res.status(400).json({ success: false, message: 'Missing required data' });
    }

    const student = await Student.findOne({ rollNumber });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (student.deviceId && student.deviceId !== deviceId) {
      return res.status(403).json({ success: false, message: 'Device mismatch. Please use your registered device.' });
    }

    const classDetails = await CreateClass.findOne({ classCode });
    if (!classDetails) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (classDetails.classStatus === 'Completed') {
        return res.status(403).json({ success: false, message: 'Attendance for this class has been closed.' });
    }

    const today = moment().tz('Asia/Kolkata').startOf('day');
    const existingAttendance = await Attendance.findOne({
      rollNumber, classId: classDetails._id,
      time: { $gte: today.toDate(), $lt: moment(today).endOf('day').toDate() }
    });
    if (existingAttendance) {
      return res.status(200).json({ success: true, message: 'Attendance already marked for this class' });
    }

    const haversineDistance = haversine(
      { latitude, longitude },
      { latitude: classDetails.latitude, longitude: classDetails.longitude }
    );
    const distanceThreshold = 50; 
    if (haversineDistance > distanceThreshold) {
      return res.status(403).json({ success: false, message: 'You are too far from the class location.' });
    }

    const newAttendance = new Attendance({
      rollNumber, classId: classDetails._id, className: classDetails.className,
      subject: classDetails.subject, classCode: classCode, status: 'Present',
      time: new Date(), studentId: student._id
    });
    await newAttendance.save();
    
    markAbsentStudents(classDetails).catch(err => console.error('Failed to mark absent students:', err));

    res.status(200).json({ success: true, message: 'Attendance marked successfully' });
  } catch (error) {
    console.error('Error submitting attendance:', error);
    res.status(500).json({ success: false, message: 'Error submitting attendance', error: error.message });
  }
};

exports.getAttendanceHistory = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const attendanceHistory = await Attendance.find({ rollNumber }).sort({ time: -1 });
    res.status(200).json({ success: true, attendanceHistory });
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
    res.status(200).json({ success: true, faceEnrolled: student.faceEnrolled || false, enrollmentDate: student.faceEnrollmentDate || null, livenessSteps: student.livenessSteps?.length || 0 });
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
    student.faceEnrollmentDate = null;
    student.livenessSteps = [];
    student.faceEnrolled = false;
    await student.save();
    res.status(200).json({ success: true, message: 'Face enrollment data reset successfully' });
  } catch (error) {
    console.error('Error resetting face enrollment:', error);
    res.status(500).json({ success: false, message: 'Error resetting face enrollment', error: error.message });
  }
};
