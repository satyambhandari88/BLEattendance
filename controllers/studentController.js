const AddClass = require('../models/AddClass');
const CreateClass = require('../models/CreateClass');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const haversine = require('haversine-distance');
const moment = require('moment-timezone');
const CryptoJS = require('crypto-js');

/**
 * Helper function to mark absent students automatically
 */
const markAbsentStudents = async (classDetails) => {
  try {
    const today = moment().tz('Asia/Kolkata').startOf('day');
    const classDate = moment.tz(`${classDetails.date} ${classDetails.startTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
    const attendanceWindowEnd = moment(classDate).add(15, 'minutes');

    if (moment().tz('Asia/Kolkata').isAfter(attendanceWindowEnd)) {
      const students = await Student.find({
        year: classDetails.year.toString(),
        department: classDetails.branch
      });

      for (const student of students) {
        const existingAttendance = await Attendance.findOne({
          rollNumber: student.rollNumber,
          className: classDetails.className,
          subject: classDetails.subject,
          time: { $gte: today.toDate(), $lt: moment(today).endOf('day').toDate() }
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

/**
 * FACE ENROLLMENT
 */
exports.enrollFace = async (req, res) => {
  try {
    const { rollNumber, faceEmbedding, livenessSteps } = req.body;
    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    student.faceEmbedding = faceEmbedding;
    student.faceEnrolled = true;
    student.faceEnrollmentDate = new Date();
    student.livenessSteps = livenessSteps;
    await student.save();

    console.log(`✅ Face enrollment completed for student: ${rollNumber}`);
    res.status(200).json({ success: true, message: 'Face enrollment completed successfully' });
  } catch (error) {
    console.error('❌ Face enrollment error:', error);
    res.status(500).json({ success: false, message: 'Face enrollment failed', error: error.message });
  }
};

/**
 * FACE VERIFICATION
 */
exports.verifyFace = async (req, res) => {
  try {
    const { rollNumber, currentFaceEmbedding } = req.body;
    const student = await Student.findOne({ rollNumber, faceEnrolled: true });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found or face not enrolled' });
    if (!student.faceEmbedding) return res.status(400).json({ success: false, message: 'No enrolled face data found' });

    const similarity = compareFaceEmbeddings(currentFaceEmbedding, student.faceEmbedding);
    const threshold = 0.75;
    const verified = similarity >= threshold;

    console.log(`Face verification for ${rollNumber}: ${verified ? 'SUCCESS' : 'FAILED'} (similarity: ${similarity})`);
    res.status(200).json({ success: true, verified, similarity, message: verified ? 'Face verification successful' : 'Face verification failed' });
  } catch (error) {
    console.error('❌ Face verification error:', error);
    res.status(500).json({ success: false, message: 'Face verification failed', error: error.message });
  }
};

/**
 * Helper functions for face comparison
 */
const compareFaceEmbeddings = (embedding1, embedding2) => {
  try {
    if (!embedding1 || !embedding2) return 0;
    const parts1 = embedding1.split('|');
    const parts2 = embedding2.split('|');
    let matches = 0;
    const minLength = Math.min(parts1.length, parts2.length);
    for (let i = 0; i < minLength; i++) {
      if (calculateStringSimilarity(parts1[i], parts2[i]) > 0.8) matches++;
    }
    return matches / minLength;
  } catch (error) {
    console.error('Face comparison error:', error);
    return 0;
  }
};

const calculateStringSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

const levenshteinDistance = (str1, str2) => {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
    }
  }
  return matrix[str2.length][str1.length];
};

/**
 * FETCH NOTIFICATIONS FOR STUDENT
 */
exports.fetchNotifications = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const serverTime = moment().tz('Asia/Kolkata');
    const formattedDate = serverTime.format('YYYY-MM-DD');

    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const classes = await CreateClass.find({
      year: student.year.toString(),
      branch: student.department,
      date: formattedDate
    }).sort({ startTime: 1 });

    const notifications = await Promise.all(classes.map(async (classInfo) => {
      await markAbsentStudents(classInfo);
      const classDate = moment.tz(`${classInfo.date} ${classInfo.startTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
      const classEndDate = moment.tz(`${classInfo.date} ${classInfo.endTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
      const attendanceWindowEnd = moment(classDate).add(15, 'minutes');

      const existingAttendance = await Attendance.findOne({
        rollNumber,
        className: classInfo.className,
        subject: classInfo.subject,
        time: { $gte: moment(classDate).startOf('day').toDate(), $lt: moment(classDate).endOf('day').toDate() }
      });

      const minutesUntilStart = classDate.diff(serverTime, 'minutes');
      const minutesFromStart = serverTime.diff(classDate, 'minutes');
      const isEnded = serverTime.isAfter(classEndDate);
      const isAttendanceWindowClosed = serverTime.isAfter(attendanceWindowEnd);

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
        status,
        minutesUntilStart: Math.max(0, minutesUntilStart),
        minutesRemaining: status === 'active' ? Math.max(0, 15 - minutesFromStart) : 0,
        attendanceId: existingAttendance?._id,
        canMarkLate: status === 'absent' && !isEnded
      };
    }));

    const activeNotifications = notifications.filter(n =>
      n.status !== 'expired' && (n.status !== 'absent' || n.canMarkLate)
    );

    res.status(200).json({ notifications: activeNotifications, serverTime: serverTime.toISOString() });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
};

/**
 * SUBMIT ATTENDANCE
 */
exports.submitAttendance = async (req, res) => {
  try {
    const { rollNumber, className, latitude, longitude, beaconProximity, classCode } = req.body;

    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const now = moment().tz('Asia/Kolkata');
    const today = now.format('YYYY-MM-DD');

    const classDetails = await CreateClass.findOne({ classCode });
    if (!classDetails) return res.status(404).json({ message: 'No matching class found for today' });

    const geoData = await AddClass.findOne({ className: new RegExp(`^${className}$`, 'i') });
    if (!geoData) return res.status(404).json({ message: 'Class location data not found' });

    // Geofence check
    const userLocation = { latitude, longitude };
    const classLocation = { latitude: geoData.latitude, longitude: geoData.longitude };
    const distance = haversine(userLocation, classLocation);
    if (distance > geoData.radius) return res.status(403).json({ message: 'You are not within the class area', distance: Math.round(distance), allowedRadius: geoData.radius });

    // Beacon check
    const expectedBeaconId = geoData?.beaconId?.trim().toLowerCase();
    const receivedBeaconId = beaconProximity?.beaconId?.trim().toLowerCase();
    if (!expectedBeaconId) return res.status(400).json({ message: 'No beacon ID configured for this class' });
    if (!receivedBeaconId || receivedBeaconId !== expectedBeaconId) return res.status(403).json({ message: 'Required beacon not detected or out of range', expectedBeaconId, receivedBeaconId });

    // Class code check
    if (classCode !== classDetails.classCode) return res.status(403).json({ message: 'Invalid class code provided', expected: classDetails.classCode });

    const classDate = moment.tz(`${classDetails.date} ${classDetails.startTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');
    const attendanceWindowEnd = moment(classDate).add(15, 'minutes');
    const classEndDate = moment.tz(`${classDetails.date} ${classDetails.endTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Kolkata');

    if (now.isAfter(classEndDate)) return res.status(403).json({ message: 'Class has already ended' });

    const existingAttendance = await Attendance.findOne({
      rollNumber,
      className: classDetails.className,
      subject: classDetails.subject,
      time: { $gte: moment(classDate).startOf('day').toDate(), $lt: moment(classDate).endOf('day').toDate() }
    });

    if (existingAttendance) {
      if (existingAttendance.status === 'Present') return res.status(400).json({ message: 'Attendance already submitted for this class' });
      if (existingAttendance.status === 'Absent' && now.isBefore(classEndDate)) {
        existingAttendance.status = 'Present';
        existingAttendance.time = now.toDate();
        existingAttendance.autoMarked = false;
        await existingAttendance.save();
        return res.status(200).json({ message: 'Late attendance submitted successfully', details: { className: classDetails.className, subject: classDetails.subject } });
      }
    }

    // Late attendance during class time
    if (now.isAfter(attendanceWindowEnd)) {
      const attendance = new Attendance({
        rollNumber,
        classId: classDetails._id,
        className: classDetails.className,
        subject: classDetails.subject,
        classCode: classDetails.classCode,
        status: 'Present',
        time: now.toDate(),
        lateSubmission: true
      });
      await attendance.save();
      return res.status(200).json({ message: 'Late attendance submitted successfully', details: { className: classDetails.className, subject: classDetails.subject } });
    }

    // Normal attendance submission
    const attendance = new Attendance({
      rollNumber,
      classId: classDetails._id,
      className: classDetails.className,
      subject: classDetails.subject,
      classCode: classDetails.classCode,
      status: 'Present',
      time: now.toDate()
    });
    await attendance.save();
    res.status(200).json({ message: 'Attendance submitted successfully', details: { className: classDetails.className, subject: classDetails.subject } });

  } catch (error) {
    console.error("❌ Error submitting attendance:", error);
    res.status(500).json({ message: 'Error submitting attendance', error: error.message });
  }
};

/**
 * GET STUDENT ATTENDANCE HISTORY
 */
exports.getAttendanceHistory = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const student = await Student.findOne({ rollNumber });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const attendanceHistory = await Attendance.find({ rollNumber }).sort({ time: -1 }).lean();

    const formattedHistory = attendanceHistory.map(record => ({
      className: record.className,
      subject: record.subject,
      status: record.status,
      date: new Date(record.time).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      time: new Date(record.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      lateSubmission: record.lateSubmission || false,
      autoMarked: record.autoMarked || false
    }));

    res.status(200).json({ success: true, history: formattedHistory });
  } catch (error) {
    console.error('Error fetching attendance history:', error);
    res.status(500).json({ success: false, message: 'Error fetching attendance history', error: error.message });
  }
};
