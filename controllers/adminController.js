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
    // Set response timeout to 5 minutes
    res.setTimeout(300000);
    
    const { year, branch, subject, month } = req.body;

    // Validate inputs
    if (!year || !branch || !subject || !month) {
      return res.status(400).json({ 
        success: false, 
        message: 'Year, branch, subject, and month are required' 
      });
    }

    // Parse month into date range (YYYY-MM)
    const [yearStr, monthStr] = month.split('-');
    const selectedYear = parseInt(yearStr);
    const selectedMonth = parseInt(monthStr) - 1;
    
    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0);
    const daysInMonth = endDate.getDate();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    console.log('Fetching students and attendance...');

    // Fetch data in parallel
    const [students, allAttendanceRecords] = await Promise.all([
      Student.find({ 
        year: year,
        department: branch 
      }).sort('rollNumber').lean(),
      
      Attendance.find({
        subject: { $regex: new RegExp(`^${subject}$`, 'i') },
        time: { $gte: startDate, $lte: endDate }
      }).lean()
    ]);

    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No students found for the selected year and branch' 
      });
    }

    console.log(`Found ${students.length} students and ${allAttendanceRecords.length} attendance records`);

    // Pre-process attendance data
    const attendanceByRollNumber = new Map();
    const dailyAttendanceStats = new Map();
    
    allAttendanceRecords.forEach(record => {
      const rollNumber = record.rollNumber.toString();
      const recordDate = new Date(record.time);
      const day = recordDate.getDate();
      
      if (!attendanceByRollNumber.has(rollNumber)) {
        attendanceByRollNumber.set(rollNumber, new Map());
      }
      attendanceByRollNumber.get(rollNumber).set(day, record.status.toLowerCase());
      
      if (!dailyAttendanceStats.has(day)) {
        dailyAttendanceStats.set(day, { present: 0, absent: 0, total: 0 });
      }
      dailyAttendanceStats.get(day).total++;
      if (record.status.toLowerCase() === 'present') {
        dailyAttendanceStats.get(day).present++;
      } else {
        dailyAttendanceStats.get(day).absent++;
      }
    });

    console.log('Starting beautiful PDF generation...');

    // Create PDF with premium settings
    const doc = new PDFDocument({ 
      margin: 30, 
      size: 'A4', 
      layout: 'landscape',
      compress: true
    });
    
    const fileName = `attendance_register_${month}.pdf`;
    const filePath = `./temp/${fileName}`;
    
    if (!fs.existsSync('./temp')) {
      fs.mkdirSync('./temp', { recursive: true });
    }

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Premium Color Palette
    const colors = {
      primary: '#1e40af',      // Deep blue
      secondary: '#7c3aed',    // Purple
      accent: '#059669',       // Emerald
      warning: '#d97706',      // Amber
      danger: '#dc2626',       // Red
      success: '#16a34a',      // Green
      dark: '#1f2937',         // Dark gray
      light: '#f8fafc',        // Light gray
      white: '#ffffff',
      border: '#e5e7eb',       // Border gray
      text: '#374151',         // Text gray
      muted: '#6b7280',        // Muted text
      gradient1: '#667eea',    // Gradient start
      gradient2: '#764ba2',    // Gradient end
      shadow: 'rgba(0,0,0,0.1)'
    };

    // Helper function to draw gradient background
    const drawGradientRect = (x, y, width, height, color1, color2) => {
      const gradient = doc.linearGradient(x, y, x + width, y);
      gradient.stop(0, color1).stop(1, color2);
      doc.rect(x, y, width, height).fill(gradient);
    };

    // Helper function to draw rounded rectangle
    const drawRoundedRect = (x, y, width, height, radius = 5) => {
      doc.roundedRect(x, y, width, height, radius);
    };

    // STUNNING HEADER SECTION
    const headerHeight = 120;
    
    // Header gradient background
    drawGradientRect(0, 0, doc.page.width, headerHeight, colors.gradient1, colors.gradient2);
    
    // Add subtle pattern overlay
    doc.save();
    doc.opacity(0.1);
    for (let i = 0; i < doc.page.width; i += 40) {
      for (let j = 0; j < headerHeight; j += 40) {
        doc.circle(i, j, 2).fill(colors.white);
      }
    }
    doc.restore();

    // Main title with shadow effect
    doc.save();
    doc.fillColor('rgba(0,0,0,0.3)').fontSize(28).font('Helvetica-Bold');
    doc.text('ATTENDANCE REGISTER', 42, 22); // Shadow
    doc.fillColor(colors.white).fontSize(28).font('Helvetica-Bold');
    doc.text('ATTENDANCE REGISTER', 40, 20); // Main text
    doc.restore();

    // Beautiful subtitle section
    doc.fillColor(colors.white).opacity(0.9);
    doc.fontSize(14).font('Helvetica');
    doc.text(`Subject: ${subject}`, 40, 55);
    doc.text(`Department: ${branch}`, 250, 55);
    doc.text(`Academic Year: ${selectedYear}`, 450, 55);
    doc.text(`Month: ${monthNames[selectedMonth]} ${selectedYear}`, 40, 75);
    doc.text(`Total Students: ${students.length}`, 250, 75);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 450, 75);

    // Decorative line
    doc.strokeColor(colors.white).opacity(0.7).lineWidth(2);
    doc.moveTo(40, 100).lineTo(doc.page.width - 40, 100).stroke();

    doc.y = headerHeight + 20;

    // STATISTICS DASHBOARD
    const dashboardY = doc.y;
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalMarked = 0;

    // Calculate overall statistics
    students.forEach(student => {
      const studentAttendance = attendanceByRollNumber.get(student.rollNumber.toString()) || new Map();
      for (let day = 1; day <= daysInMonth; day++) {
        const status = studentAttendance.get(day);
        if (status === 'present') {
          totalPresent++;
          totalMarked++;
        } else if (status === 'absent') {
          totalAbsent++;
          totalMarked++;
        }
      }
    });

    const overallPercentage = totalMarked > 0 ? (totalPresent / totalMarked) * 100 : 0;

    // Statistics cards
    const cardWidth = 150;
    const cardHeight = 60;
    const cardSpacing = 20;
    let cardX = 40;

    // Overall Attendance Card
    drawRoundedRect(cardX, dashboardY, cardWidth, cardHeight, 8);
    doc.fill(colors.light);
    doc.strokeColor(colors.primary).lineWidth(1).stroke();
    
    doc.fillColor(colors.primary).fontSize(24).font('Helvetica-Bold');
    doc.text(`${overallPercentage.toFixed(1)}%`, cardX + 10, dashboardY + 10, { width: cardWidth - 20, align: 'center' });
    doc.fillColor(colors.muted).fontSize(10).font('Helvetica');
    doc.text('Overall Attendance', cardX + 10, dashboardY + 38, { width: cardWidth - 20, align: 'center' });
    cardX += cardWidth + cardSpacing;

    // Present Days Card
    drawRoundedRect(cardX, dashboardY, cardWidth, cardHeight, 8);
    doc.fill(colors.light);
    doc.strokeColor(colors.success).lineWidth(1).stroke();
    
    doc.fillColor(colors.success).fontSize(24).font('Helvetica-Bold');
    doc.text(totalPresent.toString(), cardX + 10, dashboardY + 10, { width: cardWidth - 20, align: 'center' });
    doc.fillColor(colors.muted).fontSize(10).font('Helvetica');
    doc.text('Total Present Days', cardX + 10, dashboardY + 38, { width: cardWidth - 20, align: 'center' });
    cardX += cardWidth + cardSpacing;

    // Absent Days Card
    drawRoundedRect(cardX, dashboardY, cardWidth, cardHeight, 8);
    doc.fill(colors.light);
    doc.strokeColor(colors.danger).lineWidth(1).stroke();
    
    doc.fillColor(colors.danger).fontSize(24).font('Helvetica-Bold');
    doc.text(totalAbsent.toString(), cardX + 10, dashboardY + 10, { width: cardWidth - 20, align: 'center' });
    doc.fillColor(colors.muted).fontSize(10).font('Helvetica');
    doc.text('Total Absent Days', cardX + 10, dashboardY + 38, { width: cardWidth - 20, align: 'center' });
    cardX += cardWidth + cardSpacing;

    // Working Days Card
    drawRoundedRect(cardX, dashboardY, cardWidth, cardHeight, 8);
    doc.fill(colors.light);
    doc.strokeColor(colors.secondary).lineWidth(1).stroke();
    
    doc.fillColor(colors.secondary).fontSize(24).font('Helvetica-Bold');
    doc.text(daysInMonth.toString(), cardX + 10, dashboardY + 10, { width: cardWidth - 20, align: 'center' });
    doc.fillColor(colors.muted).fontSize(10).font('Helvetica');
    doc.text('Total Days', cardX + 10, dashboardY + 38, { width: cardWidth - 20, align: 'center' });

    doc.y = dashboardY + cardHeight + 30;

    // ATTENDANCE TABLE WITH PREMIUM STYLING
    const tableStartY = doc.y;
    const pageWidth = doc.page.width - 60;
    
    // Calculate optimal column widths
    const baseColWidth = 18;
    const dayColWidth = Math.max(baseColWidth, (pageWidth - 400) / daysInMonth);
    const headers = ['#', 'Roll No', 'Student Name', ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString()), 'Present', 'Absent', 'Percentage'];
    const columnWidths = [30, 70, 140, ...Array(daysInMonth).fill(dayColWidth), 45, 45, 55];

    // Beautiful table header with gradient
    const headerRect = drawRoundedRect(30, tableStartY, pageWidth, 35, 8);
    drawGradientRect(30, tableStartY, pageWidth, 35, colors.primary, colors.secondary);
    
    // Header shadow effect
    doc.save();
    doc.fillColor(colors.shadow);
    drawRoundedRect(32, tableStartY + 2, pageWidth, 35, 8);
    doc.fill();
    doc.restore();

    // Header text with beautiful typography
    doc.font('Helvetica-Bold').fillColor(colors.white).fontSize(10);
    
    let x = 30;
    headers.forEach((header, i) => {
      const textY = tableStartY + 12;
      if (i < 3 || i >= headers.length - 3) {
        // Main headers
        doc.text(header, x + 3, textY, { 
          width: columnWidths[i] - 6, 
          align: 'center',
          baseline: 'middle'
        });
      } else {
        // Day numbers with better formatting
        const dayNum = parseInt(header);
        const date = new Date(selectedYear, selectedMonth, dayNum);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 1);
        
        doc.fontSize(9).text(header, x + 3, textY - 2, { 
          width: columnWidths[i] - 6, 
          align: 'center' 
        });
        doc.fontSize(7).text(dayName, x + 3, textY + 8, { 
          width: columnWidths[i] - 6, 
          align: 'center' 
        });
      }
      x += columnWidths[i];
    });

    doc.y = tableStartY + 35;

    // Student rows with alternating colors and hover effects
    let rowIndex = 0;
    const rowHeight = 28;

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const studentAttendance = attendanceByRollNumber.get(student.rollNumber.toString()) || new Map();
      
      // Calculate student statistics
      let presentCount = 0;
      let absentCount = 0;
      
      for (let day = 1; day <= daysInMonth; day++) {
        const status = studentAttendance.get(day);
        if (status === 'present') presentCount++;
        else if (status === 'absent') absentCount++;
      }
      
      const totalMarkedStudent = presentCount + absentCount;
      const percentage = totalMarkedStudent > 0 ? Math.round((presentCount / totalMarkedStudent) * 100) : 0;
      
      const currentY = doc.y;

      // Beautiful row background with subtle gradients
      if (i % 2 === 0) {
        drawRoundedRect(30, currentY, pageWidth, rowHeight, 4);
        doc.fill(colors.light);
      } else {
        drawRoundedRect(30, currentY, pageWidth, rowHeight, 4);
        doc.fill(colors.white);
      }

      // Add subtle border
      doc.strokeColor(colors.border).lineWidth(0.5);
      drawRoundedRect(30, currentY, pageWidth, rowHeight, 4);
      doc.stroke();

      // Performance-based row accent (left border)
      let accentColor = colors.success;
      if (percentage < 60) accentColor = colors.danger;
      else if (percentage < 75) accentColor = colors.warning;
      
      doc.rect(30, currentY, 4, rowHeight).fill(accentColor);

      // Student data with beautiful typography
      x = 30;
      const textY = currentY + (rowHeight / 2) - 4;
      
      // Serial number
      doc.fillColor(colors.muted).fontSize(9).font('Helvetica-Bold');
      doc.text((i + 1).toString(), x + 3, textY, { 
        width: columnWidths[0] - 6, align: 'center' 
      });
      x += columnWidths[0];

      // Roll Number with styling
      doc.fillColor(colors.primary).fontSize(9).font('Helvetica-Bold');
      doc.text(student.rollNumber.toString(), x + 3, textY, { 
        width: columnWidths[1] - 6, align: 'center' 
      });
      x += columnWidths[1];

      // Student name with proper truncation
      doc.fillColor(colors.text).fontSize(9).font('Helvetica');
      const displayName = student.name.length > 20 ? student.name.substring(0, 20) + '...' : student.name;
      doc.text(displayName, x + 5, textY, { 
        width: columnWidths[2] - 10, align: 'left' 
      });
      x += columnWidths[2];

      // Daily attendance with beautiful status indicators
      for (let day = 1; day <= daysInMonth; day++) {
        const status = studentAttendance.get(day);
        const cellX = x;
        const cellY = currentY;
        
        if (status === 'present') {
          // Present - Green circle with checkmark
          doc.circle(cellX + (columnWidths[day + 2] / 2), cellY + (rowHeight / 2), 6)
             .fill(colors.success);
          doc.fillColor(colors.white).fontSize(8).font('Helvetica-Bold');
          doc.text('P', cellX + 3, textY, { 
            width: columnWidths[day + 2] - 6, align: 'center' 
          });
        } else if (status === 'absent') {
          // Absent - Red circle with X
          doc.circle(cellX + (columnWidths[day + 2] / 2), cellY + (rowHeight / 2), 6)
             .fill(colors.danger);
          doc.fillColor(colors.white).fontSize(8).font('Helvetica-Bold');
          doc.text('A', cellX + 3, textY, { 
            width: columnWidths[day + 2] - 6, align: 'center' 
          });
        } else {
          // Not marked - Light gray circle
          doc.circle(cellX + (columnWidths[day + 2] / 2), cellY + (rowHeight / 2), 4)
             .fill(colors.border);
          doc.fillColor(colors.muted).fontSize(7).font('Helvetica');
          doc.text('-', cellX + 3, textY, { 
            width: columnWidths[day + 2] - 6, align: 'center' 
          });
        }
        x += columnWidths[day + 2];
      }

      // Summary columns with beautiful styling
      // Present count
      doc.fillColor(colors.white).fontSize(8);
      doc.roundedRect(x + 2, cellY + 4, columnWidths[daysInMonth + 3] - 4, rowHeight - 8, 3)
         .fill(colors.success);
      doc.fillColor(colors.white).font('Helvetica-Bold');
      doc.text(presentCount.toString(), x + 3, textY, { 
        width: columnWidths[daysInMonth + 3] - 6, align: 'center' 
      });
      x += columnWidths[daysInMonth + 3];

      // Absent count
      doc.roundedRect(x + 2, cellY + 4, columnWidths[daysInMonth + 4] - 4, rowHeight - 8, 3)
         .fill(colors.danger);
      doc.fillColor(colors.white).font('Helvetica-Bold');
      doc.text(absentCount.toString(), x + 3, textY, { 
        width: columnWidths[daysInMonth + 4] - 6, align: 'center' 
      });
      x += columnWidths[daysInMonth + 4];

      // Percentage with gradient background
      const percentColor = percentage >= 75 ? colors.success : 
                          percentage >= 60 ? colors.warning : colors.danger;
      
      doc.roundedRect(x + 2, cellY + 4, columnWidths[daysInMonth + 5] - 4, rowHeight - 8, 3)
         .fill(percentColor);
      doc.fillColor(colors.white).fontSize(9).font('Helvetica-Bold');
      doc.text(`${percentage}%`, x + 3, textY, { 
        width: columnWidths[daysInMonth + 5] - 6, align: 'center' 
      });

      doc.y = currentY + rowHeight;
      rowIndex++;

      // Page break with header repeat
      if (doc.y > doc.page.height - 100) {
        // Add beautiful footer before page break
        doc.y = doc.page.height - 60;
        doc.strokeColor(colors.border).lineWidth(1);
        doc.moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
        
        doc.fillColor(colors.muted).fontSize(8).font('Helvetica');
        doc.text(`Page ${doc.bufferedPageRange().count}`, 30, doc.y + 10);
        doc.text(`Generated by Academic Management System`, doc.page.width - 200, doc.y + 10);
        
        doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
        
        // Repeat header on new page
        drawGradientRect(30, 40, pageWidth, 35, colors.primary, colors.secondary);
        doc.font('Helvetica-Bold').fillColor(colors.white).fontSize(10);
        x = 30;
        headers.forEach((header, i) => {
          doc.text(header, x + 3, 52, { width: columnWidths[i] - 6, align: 'center' });
          x += columnWidths[i];
        });
        doc.y = 80;
      }

      // Progress logging
      if (i > 0 && i % 25 === 0) {
        await new Promise(resolve => setImmediate(resolve));
        console.log(`Processed ${i}/${students.length} students`);
      }
    }

    // BEAUTIFUL FOOTER SECTION
    doc.y += 20;

    // Footer separator
    doc.strokeColor(colors.primary).lineWidth(2);
    doc.moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
    doc.y += 15;

    // Summary statistics in a beautiful layout
    const summaryY = doc.y;
    
    // Summary background
    drawRoundedRect(30, summaryY, pageWidth, 80, 10);
    doc.fill(colors.light);
    doc.strokeColor(colors.border).lineWidth(1).stroke();

    // Summary content
    doc.fillColor(colors.primary).fontSize(14).font('Helvetica-Bold');
    doc.text('ATTENDANCE SUMMARY', 50, summaryY + 15);

    doc.fillColor(colors.text).fontSize(11).font('Helvetica');
    doc.text(`Total Students: ${students.length}`, 50, summaryY + 35);
    doc.text(`Overall Attendance: ${overallPercentage.toFixed(2)}%`, 250, summaryY + 35);
    doc.text(`Total Present Days: ${totalPresent}`, 450, summaryY + 35);

    doc.text(`Academic Month: ${monthNames[selectedMonth]} ${selectedYear}`, 50, summaryY + 50);
    doc.text(`Subject: ${subject}`, 250, summaryY + 50);
    doc.text(`Department: ${branch}`, 450, summaryY + 50);

    // Generation timestamp
    doc.fillColor(colors.muted).fontSize(9).font('Helvetica');
    doc.text(`Report generated on ${new Date().toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, 50, summaryY + 65);

    // Beautiful signature area
    doc.text('Authorized Signature: ________________________', doc.page.width - 250, summaryY + 65);

    console.log('Finalizing beautiful PDF...');

    // Finalize PDF
    doc.end();

    // Handle file completion and sending
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('PDF generation timeout')), 240000);
    });

    const streamPromise = new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    try {
      await Promise.race([streamPromise, timeoutPromise]);
      console.log('Beautiful PDF generation completed successfully');

      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('Error sending file:', err);
          if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Error sending file' });
          }
        }
        
        // Clean up
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (cleanupErr) {
          console.error('Error cleaning up file:', cleanupErr);
        }
      });

    } catch (timeoutErr) {
      console.error('PDF generation timed out:', timeoutErr);
      
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupErr) {
        console.error('Error cleaning up on timeout:', cleanupErr);
      }

      if (!res.headersSent) {
        res.status(408).json({ 
          success: false, 
          message: 'PDF generation timed out. Please try with a smaller date range.' 
        });
      }
    }

  } catch (error) {
    console.error('Error generating beautiful attendance register:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Error generating attendance register',
        error: error.message 
      });
    }
  }
};
