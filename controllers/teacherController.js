const Class = require('../models/CreateClass');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Teacher = require('../models/Teacher');

// Generate random 5-digit code
const generateClassCode = () => {
  return Math.floor(10000 + Math.random() * 90000).toString();
};

// Create Class
exports.createClass = async (req, res) => {
  const { year, branch, subject, className, teacherName, day, date, startTime, endTime } = req.body;

  try {
    let classCode;
    let isUnique = false;

    while (!isUnique) {
      classCode = generateClassCode();
      const existingClass = await Class.findOne({ classCode });
      if (!existingClass) isUnique = true;
    }

    const newClass = new Class({
      year,
      branch,
      subject,
      className,
      teacherName,
      day,
      date,
      startTime,
      endTime,
      classCode,
      teacherId: req.user.id
    });

    await newClass.save();

    res.status(201).json({
      message: 'Class created successfully',
      classCode,
      className,
      classId: newClass._id
    });
  } catch (error) {
    console.log('Error creating class:', error);
    res.status(500).json({ message: 'Error creating class', error });
  }
};

// Updated getTeacherClasses with active status for 15 minutes from class start
exports.getTeacherClasses = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const now = new Date();

    const allClasses = await Class.find({ teacherId }).sort({ date: -1, startTime: -1 });

    const upcomingClasses = [];
    const pastClasses = [];

    allClasses.forEach(cls => {
      const [startHour, startMinute] = cls.startTime.split(':').map(Number);
      const [endHour, endMinute] = cls.endTime.split(':').map(Number);
      const classStart = new Date(cls.date);
      classStart.setHours(startHour, startMinute, 0, 0);
      const classEnd = new Date(cls.date);
      classEnd.setHours(endHour, endMinute, 0, 0);
      const activeEnd = new Date(classStart);
      activeEnd.setMinutes(activeEnd.getMinutes() + 15);

      if (now < classStart) {
        upcomingClasses.push(cls);
      } else {
        pastClasses.push({
          ...cls.toObject(),
          status: now <= activeEnd ? 'active' : 'completed'
        });
      }
    });

    res.status(200).json({
      pastClasses,
      upcomingClasses,
      totalClasses: allClasses.length
    });
  } catch (error) {
    console.log('Error fetching teacher classes:', error);
    res.status(500).json({ message: 'Error fetching classes', error });
  }
};



// Get attendance for a specific class
exports.getClassAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user.id;
    
    // Verify class belongs to teacher
    const classData = await Class.findOne({ _id: classId, teacherId });
    if (!classData) {
      return res.status(404).json({ message: 'Class not found or unauthorized' });
    }
    
    // Get all attendance records for this class (both present and absent)
    const attendanceRecords = await Attendance.find({ 
      classId: classData._id
    }).sort({ time: -1 });
    
    // Get all students who should be in this class
    const allStudents = await Student.find({
      year: classData.year.toString(),
      department: classData.branch
    });
    
    // Combine attendance with student details
    const attendanceWithDetails = allStudents.map(student => {
      const attendanceRecord = attendanceRecords.find(r => r.rollNumber === student.rollNumber);
      
      return {
        rollNumber: student.rollNumber,
        studentName: student.name,
        studentEmail: student.email,
        department: student.department,
        status: attendanceRecord ? attendanceRecord.status : 'Absent',
        time: attendanceRecord ? attendanceRecord.time : null,
        lateSubmission: attendanceRecord ? attendanceRecord.lateSubmission : false,
        autoMarked: attendanceRecord ? attendanceRecord.autoMarked : true
      };
    });
    
    // Calculate totals
    const presentCount = attendanceWithDetails.filter(r => r.status === 'Present').length;
    const absentCount = attendanceWithDetails.length - presentCount;
    
    res.status(200).json({
      classInfo: classData,
      attendanceRecords: attendanceWithDetails,
      totalPresent: presentCount,
      totalAbsent: absentCount,
      totalRecords: attendanceWithDetails.length
    });
  } catch (error) {
    console.log('Error fetching class attendance:', error);
    res.status(500).json({ message: 'Error fetching attendance', error });
  }
};

// Update/Edit Class
exports.updateClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user.id;
    const updateData = req.body;
    
    // Verify class belongs to teacher
    const classData = await Class.findOne({ _id: classId, teacherId });
    if (!classData) {
      return res.status(404).json({ message: 'Class not found or unauthorized' });
    }
    
    // Update the class
    const updatedClass = await Class.findByIdAndUpdate(
      classId,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      message: 'Class updated successfully',
      class: updatedClass
    });
  } catch (error) {
    console.log('Error updating class:', error);
    res.status(500).json({ message: 'Error updating class', error });
  }
};

// Cancel/Delete Class
exports.cancelClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user.id;
    
    // Verify class belongs to teacher
    const classData = await Class.findOne({ _id: classId, teacherId });
    if (!classData) {
      return res.status(404).json({ message: 'Class not found or unauthorized' });
    }
    
    // Delete the class
    await Class.findByIdAndDelete(classId);
    
    res.status(200).json({
      message: 'Class cancelled successfully'
    });
  } catch (error) {
    console.log('Error cancelling class:', error);
    res.status(500).json({ message: 'Error cancelling class', error });
  }
};

// Get class statistics
exports.getClassStats = async (req, res) => {
  try {
    const teacherId = req.user.id;
    
    const totalClasses = await Class.countDocuments({ teacherId });
    const currentDate = new Date();
    
    const upcomingClasses = await Class.countDocuments({
      teacherId,
      date: { $gte: currentDate.toISOString().split('T')[0] }
    });
    
    const pastClasses = totalClasses - upcomingClasses;
    
    res.status(200).json({
      totalClasses,
      upcomingClasses,
      pastClasses
    });
  } catch (error) {
    console.log('Error fetching class stats:', error);
    res.status(500).json({ message: 'Error fetching statistics', error });
  }
};