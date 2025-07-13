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
        status,
        minutesUntilStart: Math.max(0, minutesUntilStart),
        minutesRemaining: status === 'active' ? Math.max(0, 15 - minutesFromStart) : 0,
        attendanceId: existingAttendance?._id,
        canMarkLate: status === 'absent' && !isEnded // Add flag for possible late attendance marking
      };
    }));

    // Filter active notifications
    const activeNotifications = notifications.filter(n => 
      n.status !== 'expired' && (n.status !== 'absent' || n.canMarkLate)
    );

    res.status(200).json({ 
      notifications: activeNotifications,
      serverTime: serverTime.toISOString()
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
};

// Submit attendance (updated to handle late attendance)
exports.submitAttendance = async (req, res) => {
  try {
    console.log('📡 Received attendance submission request:', req.body);
    const { rollNumber, className, latitude, longitude, beaconProximity, classCode } = req.body;

    // Verify student exists
    const student = await Student.findOne({ rollNumber });
    if (!student) {
      console.error("❌ Student not found:", rollNumber);
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get today's date
    const now = moment().tz('Asia/Kolkata');
    const today = now.format('YYYY-MM-DD');

    // Find the specific class for today
    const classDetails = await CreateClass.findOne({ classCode });
    if (!classDetails) {
      console.error("❌ No matching class found for today:", { classCode, today });
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
      return res.status(403).json({ message: 'You are not within the class area', distance: Math.round(distance), allowedRadius: geoData.radius });
    }

    // VALIDATION 2: Check beacon proximity
    const expectedBeaconId = geoData?.beaconId ? geoData.beaconId.trim().toLowerCase() : null;
    const receivedBeaconId = beaconProximity?.beaconId ? beaconProximity.beaconId.trim().toLowerCase() : null;

    if (!expectedBeaconId) {
      console.error("❌ No beacon ID configured for this class");
      return res.status(400).json({ message: 'No beacon ID configured for this class' });
    }

    if (!receivedBeaconId || receivedBeaconId !== expectedBeaconId) {
      console.warn("⚠️ Beacon ID mismatch or not detected.");
      return res.status(403).json({ 
          message: 'Required beacon not detected or out of range', 
          expectedBeaconId: geoData?.beaconId,
          receivedBeaconId: beaconProximity?.beaconId
      });
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
        await existingAttendance.save();
        console.log("✅ Updated absent to present attendance!");
        return res.status(200).json({
          message: 'Late attendance submitted successfully',
          details: { className: classDetails.className, subject: classDetails.subject }
        });
      }
    }

    // Allow late attendance submission if still during class time
if (now.isAfter(attendanceWindowEnd)) {
  console.log("⚠️ Attendance submitted after window but during class time - marking as late");
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
  console.log("✅ Late attendance marked successfully!");
  return res.status(200).json({
    message: 'Late attendance submitted successfully',
    details: { className: classDetails.className, subject: classDetails.subject }
  });
}

    // Normal attendance submission within window
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
    console.log("✅ Attendance marked successfully!");

    return res.status(200).json({
      message: 'Attendance submitted successfully',
      details: { className: classDetails.className, subject: classDetails.subject }
    });

  } catch (error) {
    console.error("❌ Error submitting attendance:", error);
    return res.status(500).json({ message: 'Error submitting attendance', error: error.message });
  }
};

// Get student attendance history (unchanged)
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
      autoMarked: record.autoMarked || false
    }));

    res.status(200).json({ 
      success: true,
      history: formattedHistory 
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