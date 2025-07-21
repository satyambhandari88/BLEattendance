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

    // Pre-process attendance data efficiently
    const attendanceByRollNumber = new Map();
    
    allAttendanceRecords.forEach(record => {
      const rollNumber = record.rollNumber.toString();
      const recordDate = new Date(record.time);
      const day = recordDate.getDate();
      
      if (!attendanceByRollNumber.has(rollNumber)) {
        attendanceByRollNumber.set(rollNumber, new Map());
      }
      attendanceByRollNumber.get(rollNumber).set(day, record.status.toLowerCase());
    });

    console.log('Starting optimized beautiful PDF generation...');

    // Create PDF with optimized settings
    const doc = new PDFDocument({ 
      margin: 30, 
      size: 'A4', 
      layout: 'landscape',
      compress: true,
      bufferPages: true // Enable page buffering for better performance
    });
    
    const fileName = `attendance_register_${month}.pdf`;
    const filePath = `./temp/${fileName}`;
    
    if (!fs.existsSync('./temp')) {
      fs.mkdirSync('./temp', { recursive: true });
    }

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Optimized Color Palette
    const colors = {
      primary: '#1e40af',
      secondary: '#7c3aed',
      accent: '#059669',
      warning: '#d97706',
      danger: '#dc2626',
      success: '#16a34a',
      dark: '#1f2937',
      light: '#f8fafc',
      white: '#ffffff',
      border: '#e5e7eb',
      text: '#374151',
      muted: '#6b7280'
    };

    // BEAUTIFUL BUT OPTIMIZED HEADER
    const headerHeight = 100;
    
    // Simple gradient background (faster than complex patterns)
    const gradient = doc.linearGradient(0, 0, doc.page.width, headerHeight);
    gradient.stop(0, colors.primary).stop(1, colors.secondary);
    doc.rect(0, 0, doc.page.width, headerHeight).fill(gradient);

    // Header text with simple shadow
    doc.save();
    doc.fillColor('rgba(0,0,0,0.2)').fontSize(26).font('Helvetica-Bold');
    doc.text('ATTENDANCE REGISTER', 42, 22); // Shadow
    doc.fillColor(colors.white).fontSize(26).font('Helvetica-Bold');
    doc.text('ATTENDANCE REGISTER', 40, 20); // Main text
    doc.restore();

    // Optimized subtitle section
    doc.fillColor(colors.white).fontSize(12).font('Helvetica');
    doc.text(`Subject: ${subject} | Department: ${branch} | Academic Year: ${selectedYear}`, 40, 50);
    doc.text(`Month: ${monthNames[selectedMonth]} ${selectedYear} | Total Students: ${students.length}`, 40, 68);

    // Simple decorative line
    doc.strokeColor(colors.white).lineWidth(2);
    doc.moveTo(40, 85).lineTo(doc.page.width - 40, 85).stroke();

    doc.y = headerHeight + 15;

    // OPTIMIZED STATISTICS SECTION
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalMarked = 0;

    // Pre-calculate all statistics
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

    // Simple but beautiful stats cards
    const cardY = doc.y;
    const cardWidth = 160;
    const cardHeight = 50;
    
    // Overall Attendance Card
    doc.roundedRect(40, cardY, cardWidth, cardHeight, 6)
       .fill(colors.light)
       .strokeColor(colors.primary)
       .lineWidth(2)
       .stroke();
    
    doc.fillColor(colors.primary).fontSize(20).font('Helvetica-Bold');
    doc.text(`${overallPercentage.toFixed(1)}%`, 50, cardY + 8, { width: cardWidth - 20, align: 'center' });
    doc.fillColor(colors.muted).fontSize(9).font('Helvetica');
    doc.text('Overall Attendance', 50, cardY + 32, { width: cardWidth - 20, align: 'center' });

    // Present Days Card
    doc.roundedRect(220, cardY, cardWidth, cardHeight, 6)
       .fill(colors.light)
       .strokeColor(colors.success)
       .lineWidth(2)
       .stroke();
    
    doc.fillColor(colors.success).fontSize(20).font('Helvetica-Bold');
    doc.text(totalPresent.toString(), 230, cardY + 8, { width: cardWidth - 20, align: 'center' });
    doc.fillColor(colors.muted).fontSize(9).font('Helvetica');
    doc.text('Total Present Days', 230, cardY + 32, { width: cardWidth - 20, align: 'center' });

    // Absent Days Card
    doc.roundedRect(400, cardY, cardWidth, cardHeight, 6)
       .fill(colors.light)
       .strokeColor(colors.danger)
       .lineWidth(2)
       .stroke();
    
    doc.fillColor(colors.danger).fontSize(20).font('Helvetica-Bold');
    doc.text(totalAbsent.toString(), 410, cardY + 8, { width: cardWidth - 20, align: 'center' });
    doc.fillColor(colors.muted).fontSize(9).font('Helvetica');
    doc.text('Total Absent Days', 410, cardY + 32, { width: cardWidth - 20, align: 'center' });

    doc.y = cardY + cardHeight + 20;

    // OPTIMIZED TABLE DESIGN
    const tableStartY = doc.y;
    const pageWidth = doc.page.width - 60;
    
    // Calculate column widths efficiently
    const baseColWidth = Math.max(18, (pageWidth - 400) / daysInMonth);
    const headers = ['#', 'Roll No', 'Student Name', ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString()), 'P', 'A', '%'];
    const columnWidths = [30, 60, 130, ...Array(daysInMonth).fill(baseColWidth), 35, 35, 45];

    // Beautiful table header
    const headerGradient = doc.linearGradient(30, tableStartY, 30, tableStartY + 30);
    headerGradient.stop(0, colors.primary).stop(1, colors.secondary);
    doc.roundedRect(30, tableStartY, pageWidth, 30, 6).fill(headerGradient);

    // Header text
    doc.font('Helvetica-Bold').fillColor(colors.white).fontSize(9);
    let x = 30;
    headers.forEach((header, i) => {
      doc.text(header, x + 2, tableStartY + 10, { 
        width: columnWidths[i] - 4, 
        align: 'center'
      });
      x += columnWidths[i];
    });

    doc.y = tableStartY + 30;

    // HIGHLY OPTIMIZED STUDENT ROWS
    const rowHeight = 22;
    let processedCount = 0;

    for (const student of students) {
      const studentAttendance = attendanceByRollNumber.get(student.rollNumber.toString()) || new Map();
      
      // Calculate statistics once
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

      // Simple alternating background
      if (processedCount % 2 === 0) {
        doc.rect(30, currentY, pageWidth, rowHeight).fill(colors.light);
      }

      // Performance indicator (simple colored left border)
      const accentColor = percentage >= 75 ? colors.success : 
                         percentage >= 60 ? colors.warning : colors.danger;
      doc.rect(30, currentY, 3, rowHeight).fill(accentColor);

      // Student data with optimized rendering
      x = 30;
      const textY = currentY + 7;
      
      // Serial number
      doc.fillColor(colors.muted).fontSize(8).font('Helvetica-Bold');
      doc.text((processedCount + 1).toString(), x + 2, textY, { 
        width: columnWidths[0] - 4, align: 'center' 
      });
      x += columnWidths[0];

      // Roll Number
      doc.fillColor(colors.primary).fontSize(8).font('Helvetica-Bold');
      doc.text(student.rollNumber.toString(), x + 2, textY, { 
        width: columnWidths[1] - 4, align: 'center' 
      });
      x += columnWidths[1];

      // Student name (optimized truncation)
      doc.fillColor(colors.text).fontSize(8).font('Helvetica');
      const displayName = student.name.length > 18 ? student.name.substring(0, 18) + '...' : student.name;
      doc.text(displayName, x + 3, textY, { 
        width: columnWidths[2] - 6, align: 'left' 
      });
      x += columnWidths[2];

      // Daily attendance (simplified but still beautiful)
      doc.fontSize(7).font('Helvetica-Bold');
      for (let day = 1; day <= daysInMonth; day++) {
        const status = studentAttendance.get(day);
        
        if (status === 'present') {
          doc.fillColor(colors.success).text('P', x + 2, textY, { 
            width: columnWidths[day + 2] - 4, align: 'center' 
          });
        } else if (status === 'absent') {
          doc.fillColor(colors.danger).text('A', x + 2, textY, { 
            width: columnWidths[day + 2] - 4, align: 'center' 
          });
        } else {
          doc.fillColor(colors.muted).text('—', x + 2, textY, { 
            width: columnWidths[day + 2] - 4, align: 'center' 
          });
        }
        x += columnWidths[day + 2];
      }

      // Summary columns
      doc.fillColor(colors.success).fontSize(8).font('Helvetica-Bold');
      doc.text(presentCount.toString(), x + 2, textY, { 
        width: columnWidths[daysInMonth + 3] - 4, align: 'center' 
      });
      x += columnWidths[daysInMonth + 3];

      doc.fillColor(colors.danger);
      doc.text(absentCount.toString(), x + 2, textY, { 
        width: columnWidths[daysInMonth + 4] - 4, align: 'center' 
      });
      x += columnWidths[daysInMonth + 4];

      // Percentage with color coding
      const percentColor = percentage >= 75 ? colors.success : 
                          percentage >= 60 ? colors.warning : colors.danger;
      doc.fillColor(percentColor).fontSize(8).font('Helvetica-Bold');
      doc.text(`${percentage}%`, x + 2, textY, { 
        width: columnWidths[daysInMonth + 5] - 4, align: 'center' 
      });

      doc.y = currentY + rowHeight;
      processedCount++;

      // Page break check
      if (doc.y > doc.page.height - 80) {
        doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
        
        // Repeat header
        const newHeaderGradient = doc.linearGradient(30, 40, 30, 70);
        newHeaderGradient.stop(0, colors.primary).stop(1, colors.secondary);
        doc.roundedRect(30, 40, pageWidth, 30, 6).fill(newHeaderGradient);
        
        doc.font('Helvetica-Bold').fillColor(colors.white).fontSize(9);
        x = 30;
        headers.forEach((header, i) => {
          doc.text(header, x + 2, 50, { width: columnWidths[i] - 4, align: 'center' });
          x += columnWidths[i];
        });
        doc.y = 75;
      }

      // Yield control every 20 students for better performance
      if (processedCount % 20 === 0) {
        await new Promise(resolve => setImmediate(resolve));
        console.log(`Processed ${processedCount}/${students.length} students`);
      }
    }

    // BEAUTIFUL FOOTER
    doc.y += 15;

    // Footer separator
    doc.strokeColor(colors.primary).lineWidth(1);
    doc.moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();
    doc.y += 10;

    // Summary section
    doc.roundedRect(30, doc.y, pageWidth, 60, 8)
       .fill(colors.light)
       .strokeColor(colors.border)
       .lineWidth(1)
       .stroke();

    doc.fillColor(colors.primary).fontSize(12).font('Helvetica-Bold');
    doc.text('ATTENDANCE SUMMARY', 40, doc.y + 10);

    doc.fillColor(colors.text).fontSize(10).font('Helvetica');
    doc.text(`Total Students: ${students.length} | Overall Attendance: ${overallPercentage.toFixed(2)}% | Subject: ${subject}`, 40, doc.y + 28);
    doc.text(`Department: ${branch} | Month: ${monthNames[selectedMonth]} ${selectedYear}`, 40, doc.y + 42);

    // Generation info
    doc.fillColor(colors.muted).fontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 40, doc.y + 50);
    doc.text('Authorized Signature: ________________________', doc.page.width - 220, doc.y + 50);

    console.log('Finalizing optimized beautiful PDF...');

    // Finalize PDF
    doc.end();

    // Handle completion with proper timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('PDF generation timeout')), 180000); // Reduced to 3 minutes
    });

    const streamPromise = new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    try {
      await Promise.race([streamPromise, timeoutPromise]);
      console.log('Optimized beautiful PDF generation completed successfully');

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
    console.error('Error generating optimized attendance register:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Error generating attendance register',
        error: error.message 
      });
    }
  }
};
