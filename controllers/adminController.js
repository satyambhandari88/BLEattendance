const mongoose = require('mongoose');  
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Class = require('../models/AddClass');
const Year = require('../models/Year');
const Branch = require('../models/Branch');
const Subject = require('../models/Subject');
const AcademicStructure = require('../models/AcademicStructure');
const PDFDocument = require('pdfkit');
const Attendance = require('../models/Attendance');

const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');













// Add Student
exports.addStudent = async (req, res) => {
  try {
    const { rollNumber, name, email, password, department, year, faceData } = req.body;

    const newStudent = new Student({ rollNumber, name, email, password, department, year, faceData });
    await newStudent.save();

    res.status(201).json({ message: 'Student added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding student', error });
  }
};




exports.fetchStudents=async (req, res) => {
  try {
    const students = await Student.find();
    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch students' });
  }
};







// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Upload CSV middleware
exports.uploadMiddleware = upload.single('file');

// Controller function for processing CSV uploads
exports.uploadCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const students = [];

  try {
    // Process CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => {
          // Validate required fields
          if (row.rollNumber && row.name && row.email && row.department && row.year) {
            students.push({
              rollNumber: row.rollNumber,
              name: row.name,
              email: row.email,
              password: row.password || 'defaultPassword', // Set a default password if not provided
              department: row.department,
              year: row.year,
              faceData: row.faceData || '' // Optional field
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Bulk insert students into the database
    if (students.length > 0) {
      const result = await Student.insertMany(students, { ordered: false });
      res.status(200).json({
        success: true,
        message: `${result.length} students added successfully`,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'No valid student records found in CSV',
      });
    }

    const result = await Student.create(students);
    
    res.status(200).json({
      success: true,
      message: `${result.length} students added successfully`,
    });
  } catch (error) {
    console.error('Error processing CSV:', error);
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'Duplicate entries found in CSV file. Please check roll numbers and emails.',
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error processing CSV file',
        error: error.message
      });
    }
  } finally {
    // Clean up: remove the uploaded file
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Error removing uploaded file:', err);
    }
  }
};









// Add Teacher
exports.addTeacher = async (req, res) => {
  try {
    const { id, name, email, password, department, subjects } = req.body;

    // Validate department exists
    const departmentExists = await Branch.findById(department);
    if (!departmentExists) {
      return res.status(400).json({ message: 'Invalid department' });
    }

    // Validate subjects exist (if any are provided)
    if (subjects && subjects.length > 0) {
      const subjectsExist = await Subject.countDocuments({ _id: { $in: subjects } });
      if (subjectsExist !== subjects.length) {
        return res.status(400).json({ message: 'One or more subjects are invalid' });
      }
    }

    const newTeacher = new Teacher({ 
      id, 
      name, 
      email, 
      password, 
      department,
      subjects: subjects || [] // Handle case where subjects might be undefined
    });

    await newTeacher.save();

    // Populate the response with department and subjects details
    const populatedTeacher = await Teacher.findById(newTeacher._id)
      .populate('department')
      .populate('subjects');

    res.status(201).json({ 
      message: 'Teacher added successfully',
      teacher: populatedTeacher
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Teacher ID or email already exists',
        error: error.message 
      });
    }
    res.status(500).json({ 
      message: 'Error adding teacher', 
      error: error.message 
    });
  }
};






exports.fetchTeachers=async (req, res) => {
  try {
    const teachers = await Teacher.find();
    res.json({ success: true, teachers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch teachers' });
  }
};





// Add Class
// Add Class
exports.addClass = async (req, res) => {
  try {
    const { className, longitude, latitude, radius, beaconId } = req.body;

    const newClass = new Class({ className, longitude, latitude, radius, beaconId });
    await newClass.save();

    res.status(201).json({ message: 'Class added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding class', error });
  }
};




  exports.fetchClasses=async (req, res) => {
    try {
      const classes = await Class.find();
      res.json({ success: true, classes });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch classes' });
    }
  };



  exports.addYear = async (req, res) => {
  try {
    const year = new Year(req.body);
    await year.save();
    res.status(201).json({ message: 'Year added successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error adding year', error: err.message });
  }
};



exports.addBranch = async (req, res) => {
  try {
    const branch = new Branch(req.body);
    await branch.save();
    res.status(201).json({ message: 'Branch added successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error adding branch', error: err.message });
  }
};



exports.addSubject = async (req, res) => {
  try {
    const subject = new Subject(req.body);
    await subject.save();
    res.status(201).json({ message: 'Subject added successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error adding subject', error: err.message });
  }
};




exports.addAcademicStructure = async (req, res) => {
  try {
    const { year, branch, subjects } = req.body;

    const structure = new AcademicStructure({ year, branch, subjects });
    await structure.save();

    res.status(201).json({ message: 'Academic structure created successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error creating academic structure', error: err.message });
  }
};



// Fetch all years
exports.getAllYears = async (req, res) => {
  try {
    const years = await Year.find();
    res.status(200).json({ success: true, years });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch years', error: err.message });
  }
};

// Fetch all branches
exports.getAllBranches = async (req, res) => {
  try {
    const branches = await Branch.find();
    res.status(200).json({ success: true, branches });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch branches', error: err.message });
  }
};

// Fetch all subjects
exports.getAllSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().select('_id name'); // Only get id and name
    res.status(200).json({ success: true, subjects });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch subjects', error: err.message });
  }
};


exports.getAcademicStructures = async (req, res) => {
  try {
    const structures = await AcademicStructure.find()
      .populate('year', 'name')
      .populate('branch', 'name')
      .populate('subjects', '_id name');
    
    res.status(200).json({ success: true, structures });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch academic structures', error: err.message });
  }
};


// Get subjects assigned to teacher for specific year and branch

exports.getTeacherSubjects = async (req, res) => {
  try {
    const { teacherId, yearId, branchId } = req.params;

    // 1. Validate all IDs first
    if (!mongoose.Types.ObjectId.isValid(teacherId) || 
        !mongoose.Types.ObjectId.isValid(yearId) || 
        !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({
        success: false,
        message: 'All IDs must be valid MongoDB ObjectIds',
        receivedIds: { teacherId, yearId, branchId }
      });
    }

    // 2. Convert to ObjectIds - do this before any usage
    const teacherObjId = new mongoose.Types.ObjectId(teacherId);
    const yearObjId = new mongoose.Types.ObjectId(yearId);
    const branchObjId = new mongoose.Types.ObjectId(branchId);

    // 3. Find teacher
    const teacher = await Teacher.findById(teacherObjId).populate('subjects');
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found',
        teacherId: teacherObjId
      });
    }

    // 4. Get academic structure
    const structure = await AcademicStructure.findOne({
      year: yearObjId,
      branch: branchObjId
    }).populate('subjects');

    if (!structure) {
      return res.status(404).json({
        success: false,
        message: 'Academic structure not found for this year/branch',
        yearId: yearObjId,
        branchId: branchObjId
      });
    }

    // 5. Filter teacher's authorized subjects
    const availableSubjects = structure.subjects
      .filter(subject => teacher.subjects.some(
        teacherSubj => teacherSubj._id.equals(subject._id)
      ))
      .map(subject => ({
        _id: subject._id,
        name: subject.name,
        code: subject.code || ''
      }));

    return res.status(200).json({
      success: true,
      subjects: availableSubjects,
      count: availableSubjects.length
    });

  } catch (err) {
    console.error('Server error in getTeacherSubjects:', {
      error: err.message,
      stack: err.stack,
      params: req.params,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching subjects',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};





exports.generateAttendanceRegister = async (req, res) => {
  try {
    const { year, branch, subject, month } = req.body;
    
    // Validate inputs
    if (!year || !branch || !subject || !month) {
      return res.status(400).json({ 
        success: false, 
        message: 'Year, branch, subject, and month are required' 
      });
    }

    // Parse month and year (format: YYYY-MM)
    const [yearStr, monthStr] = month.split('-');
    const selectedYear = parseInt(yearStr);
    const selectedMonth = parseInt(monthStr) - 1; // JavaScript months are 0-indexed
    
    // Validate month format
    if (isNaN(selectedYear) || isNaN(selectedMonth) || selectedMonth < 0 || selectedMonth > 11) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid month format. Use YYYY-MM' 
      });
    }

    // Get all students for the selected year and branch
    const students = await Student.find({ 
      year: year,
      department: branch 
    }).sort('rollNumber');

    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No students found for the selected year and branch' 
      });
    }

    // Get number of days in the selected month
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    // Prepare the PDF document
    const doc = new PDFDocument({ margin: 30 });
    const fileName = `attendance_register_${month}.pdf`;
    const filePath = `./temp/${fileName}`;
    
    // Ensure temp directory exists
    if (!fs.existsSync('./temp')) {
      fs.mkdirSync('./temp');
    }

    // Pipe the PDF to a file
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Add header
    doc.fontSize(18).text('Monthly Attendance Register', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Month: ${month} | Branch: ${branch} | Year: ${year} | Subject: ${subject}`, { align: 'center' });
    doc.moveDown(2);

    // Create table headers
    const headers = ['Roll No', 'Name', ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString()), 'Present', 'Absent', '%'];
    const columnWidths = [60, 120, ...Array(daysInMonth).fill(20), 50, 50, 40];
    
    // Draw table headers
    doc.font('Helvetica-Bold');
    let x = 30;
    headers.forEach((header, i) => {
      doc.text(header, x, doc.y, { width: columnWidths[i], align: 'center' });
      x += columnWidths[i];
    });
    doc.moveDown();

    // Draw horizontal line
    doc.moveTo(30, doc.y).lineTo(x, doc.y).stroke();

    // Process each student
    doc.font('Helvetica');
    for (const student of students) {
      // Get attendance records for this student and subject for the entire month
      const attendanceRecords = await Attendance.find({
        student: student._id,
        subject: subject,
        date: {
          $gte: new Date(selectedYear, selectedMonth, 1),
          $lte: new Date(selectedYear, selectedMonth, daysInMonth)
        }
      }).sort('date');

      // Create day-wise attendance status
      const dayStatus = {};
      attendanceRecords.forEach(record => {
        const day = record.date.getDate();
        dayStatus[day] = record.status === 'present' ? 'P' : 'A';
      });

      // Calculate totals
      const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
      const absentCount = daysInMonth - presentCount;
      const percentage = Math.round((presentCount / daysInMonth) * 100);

      // Add student row to PDF
      x = 30;
      doc.text(student.rollNumber.toString(), x, doc.y, { width: columnWidths[0], align: 'center' });
      x += columnWidths[0];
      doc.text(student.name, x, doc.y, { width: columnWidths[1], align: 'left' });
      x += columnWidths[1];

      // Add day columns
      for (let day = 1; day <= daysInMonth; day++) {
        doc.text(dayStatus[day] || '-', x, doc.y, { width: columnWidths[day + 1], align: 'center' });
        x += columnWidths[day + 1];
      }

      // Add totals
      doc.text(presentCount.toString(), x, doc.y, { width: columnWidths[daysInMonth + 2], align: 'center' });
      x += columnWidths[daysInMonth + 2];
      doc.text(absentCount.toString(), x, doc.y, { width: columnWidths[daysInMonth + 3], align: 'center' });
      x += columnWidths[daysInMonth + 3];
      doc.text(`${percentage}%`, x, doc.y, { width: columnWidths[daysInMonth + 4], align: 'center' });

      doc.moveDown();
    }

    // Add legend
    doc.moveDown(2);
    doc.font('Helvetica-Bold').text('Legend:', 30, doc.y);
    doc.font('Helvetica').text('P = Present, A = Absent, - = No record', 30, doc.y + 20);

    // Finalize PDF
    doc.end();

    // Wait for PDF to be generated
    await new Promise(resolve => stream.on('finish', resolve));

    // Send the file
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Clean up: delete the temporary file
      fs.unlinkSync(filePath);
    });

  } catch (error) {
    console.error('Error generating attendance register:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error generating attendance register',
      error: error.message 
    });
  }
};

