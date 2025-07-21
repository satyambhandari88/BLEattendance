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

    // Parse month into date range (YYYY-MM)
    const [yearStr, monthStr] = month.split('-');
    const startDate = new Date(yearStr, monthStr - 1, 1); // First day of month
    const endDate = new Date(yearStr, monthStr, 0); // Last day of month

    // Find students matching year & branch
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

    // Get ALL attendance records for this subject (no className filter)
    const attendanceQuery = {
      subject: { $regex: new RegExp(`^${subject}$`, 'i') }, // Case-insensitive match
      date: { $gte: startDate, $lte: endDate }
    };

    // Fetch all matching attendance records at once (optimized)
    const allAttendanceRecords = await Attendance.find(attendanceQuery);

    // Group attendance by student for faster lookup
    const attendanceByStudent = new Map();
    allAttendanceRecords.forEach(record => {
      const studentId = record.student.toString();
      if (!attendanceByStudent.has(studentId)) {
        attendanceByStudent.set(studentId, []);
      }
      attendanceByStudent.get(studentId).push(record);
    });

    // Generate PDF (same as before, but now includes all classes of the subject)
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    
    const fileName = `attendance_register_${month}.pdf`;
    const filePath = `./temp/${fileName}`;
    
    // Ensure temp directory exists
    if (!fs.existsSync('./temp')) {
      fs.mkdirSync('./temp');
    }

    // Pipe the PDF to a file
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Define colors
    const colors = {
      primary: '#2563eb',      // Professional blue
      secondary: '#64748b',    // Slate gray
      success: '#16a34a',      // Green for present
      danger: '#dc2626',       // Red for absent
      background: '#f8fafc',   // Light background
      border: '#e2e8f0',       // Border color
      text: '#1e293b'          // Dark text
    };

    // Add decorative header background
    doc.rect(0, 0, doc.page.width, 120).fill(colors.primary);
    
    // Add institution logo area (placeholder)
    doc.circle(80, 60, 25).fill('#ffffff');
    doc.fillColor(colors.primary).fontSize(16).font('Helvetica-Bold')
       .text('LOGO', 68, 55, { width: 24, align: 'center' });

    // Main title
    doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold')
       .text('MONTHLY ATTENDANCE REGISTER', 140, 35, { align: 'left' });

    // Subtitle with decorative elements
    doc.fontSize(12).font('Helvetica')
       .text('Academic Performance Tracking System', 140, 65, { align: 'left' });

    // Add decorative elements
    doc.rect(doc.page.width - 100, 20, 80, 80).fill('rgba(255,255,255,0.1)');
    doc.circle(doc.page.width - 60, 60, 30).stroke('#ffffff');

    // Reset position for content
    doc.y = 140;

    // Information cards section
    const cardY = doc.y;
    const cardHeight = 60;
    const cardWidth = (doc.page.width - 120) / 4;

    // Draw information cards
    const infoCards = [
      { label: 'Academic Year', value: year, icon: '📅' },
      { label: 'Department', value: branch, icon: '🏢' },
      { label: 'Subject', value: subject, icon: '📚' },
      { label: 'Month', value: `${monthNames[selectedMonth]} ${selectedYear}`, icon: '🗓️' }
    ];

    infoCards.forEach((card, index) => {
      const x = 40 + (index * (cardWidth + 10));
      
      // Card background with gradient effect
      doc.rect(x, cardY, cardWidth, cardHeight).fill(colors.background);
      doc.rect(x, cardY, cardWidth, 4).fill(colors.primary);
      
      // Card content
      doc.fillColor(colors.secondary).fontSize(10).font('Helvetica')
         .text(card.label, x + 10, cardY + 12);
      
      doc.fillColor(colors.text).fontSize(12).font('Helvetica-Bold')
         .text(card.value, x + 10, cardY + 28, { width: cardWidth - 20, ellipsis: true });
      
      // Icon
      doc.fontSize(16).text(card.icon, x + cardWidth - 30, cardY + 22);
    });

    doc.y = cardY + cardHeight + 30;

    // Enhanced table styling
    const tableStartY = doc.y;
    const pageWidth = doc.page.width - 80;
    
    // Calculate dynamic column widths
    const fixedColsWidth = 200; // Roll No (60) + Name (140)
    const summaryColsWidth = 140; // Present (40) + Absent (40) + % (40) + Total (20)
    const availableWidth = pageWidth - fixedColsWidth - summaryColsWidth;
    const dayColWidth = Math.max(18, Math.min(25, availableWidth / daysInMonth));
    
    const headers = ['Roll No', 'Student Name', ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString()), 'Present', 'Absent', '%', 'Grade'];
    const columnWidths = [60, 140, ...Array(daysInMonth).fill(dayColWidth), 45, 45, 35, 50];

    // Draw table header background
    doc.rect(40, tableStartY - 5, pageWidth, 35).fill(colors.primary);
    
    // Table headers with enhanced styling
    doc.font('Helvetica-Bold').fillColor('#ffffff').fontSize(10);
    let x = 40;
    let headerY = tableStartY + 5;
    
    headers.forEach((header, i) => {
      if (i < 2) {
        // Fixed columns
        doc.text(header, x + 5, headerY, { width: columnWidths[i] - 10, align: 'center' });
      } else if (i >= headers.length - 4) {
        // Summary columns
        doc.text(header, x + 2, headerY, { width: columnWidths[i] - 4, align: 'center' });
      } else {
        // Day columns - vertical text for better fit
        doc.text(header, x + 2, headerY, { width: columnWidths[i] - 4, align: 'center' });
      }
      x += columnWidths[i];
    });

    doc.y = tableStartY + 30;

    // Enhanced student rows
    doc.font('Helvetica').fontSize(9);
    let rowIndex = 0;
    
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
      const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
      const totalMarkedDays = presentCount + absentCount;
      const percentage = totalMarkedDays > 0 ? Math.round((presentCount / totalMarkedDays) * 100) : 0;
      
      // Determine grade based on percentage
      let grade = 'F';
      let gradeColor = colors.danger;
      if (percentage >= 90) { grade = 'A+'; gradeColor = '#059669'; }
      else if (percentage >= 80) { grade = 'A'; gradeColor = colors.success; }
      else if (percentage >= 70) { grade = 'B'; gradeColor = '#d97706'; }
      else if (percentage >= 60) { grade = 'C'; gradeColor = '#dc6d20'; }
      else if (percentage >= 50) { grade = 'D'; gradeColor = '#dc2626'; }

      const currentY = doc.y;
      const rowHeight = 25;

      // Alternating row background
      if (rowIndex % 2 === 0) {
        doc.rect(40, currentY - 2, pageWidth, rowHeight).fill('#f8fafc');
      }

      // Row border
      doc.rect(40, currentY - 2, pageWidth, rowHeight).stroke(colors.border);

      // Student data
      x = 40;
      doc.fillColor(colors.text);
      
      // Roll Number
      doc.font('Helvetica-Bold').text(student.rollNumber.toString(), x + 5, currentY + 6, { 
        width: columnWidths[0] - 10, align: 'center' 
      });
      x += columnWidths[0];

      // Name
      doc.font('Helvetica').text(student.name, x + 5, currentY + 6, { 
        width: columnWidths[1] - 10, align: 'left', ellipsis: true 
      });
      x += columnWidths[1];

      // Day columns with color coding
      for (let day = 1; day <= daysInMonth; day++) {
        const status = dayStatus[day];
        let displayText = status || '-';
        let textColor = colors.text;
        
        if (status === 'P') {
          textColor = colors.success;
          doc.circle(x + dayColWidth/2, currentY + 12, 6).fill('rgba(34, 197, 94, 0.1)');
        } else if (status === 'A') {
          textColor = colors.danger;
          doc.circle(x + dayColWidth/2, currentY + 12, 6).fill('rgba(220, 38, 38, 0.1)');
        }
        
        doc.fillColor(textColor).font('Helvetica-Bold').fontSize(8)
           .text(displayText, x + 2, currentY + 8, { width: columnWidths[day + 1] - 4, align: 'center' });
        x += columnWidths[day + 1];
      }

      // Summary columns with enhanced styling
      doc.fontSize(9).font('Helvetica-Bold');
      
      // Present count
      doc.fillColor(colors.success).text(presentCount.toString(), x + 2, currentY + 6, { 
        width: columnWidths[daysInMonth + 2] - 4, align: 'center' 
      });
      x += columnWidths[daysInMonth + 2];

      // Absent count
      doc.fillColor(colors.danger).text(absentCount.toString(), x + 2, currentY + 6, { 
        width: columnWidths[daysInMonth + 3] - 4, align: 'center' 
      });
      x += columnWidths[daysInMonth + 3];

      // Percentage with color coding
      let percentColor = colors.danger;
      if (percentage >= 75) percentColor = colors.success;
      else if (percentage >= 60) percentColor = '#d97706';
      
      doc.fillColor(percentColor).text(`${percentage}%`, x + 2, currentY + 6, { 
        width: columnWidths[daysInMonth + 4] - 4, align: 'center' 
      });
      x += columnWidths[daysInMonth + 4];

      // Grade with background
      doc.rect(x + 5, currentY + 3, columnWidths[daysInMonth + 5] - 10, 16).fill(gradeColor);
      doc.fillColor('#ffffff').font('Helvetica-Bold').text(grade, x + 2, currentY + 6, { 
        width: columnWidths[daysInMonth + 5] - 4, align: 'center' 
      });

      doc.y = currentY + rowHeight;
      rowIndex++;

      // Check for page break
      if (doc.y > doc.page.height - 150) {
        doc.addPage({ margin: 40, size: 'A4', layout: 'landscape' });
        
        // Repeat headers on new page
        doc.rect(40, 40, pageWidth, 35).fill(colors.primary);
        doc.font('Helvetica-Bold').fillColor('#ffffff').fontSize(10);
        x = 40;
        headers.forEach((header, i) => {
          doc.text(header, x + 5, 50, { width: columnWidths[i] - 10, align: 'center' });
          x += columnWidths[i];
        });
        doc.y = 80;
        rowIndex = 0;
      }
    }

    // Enhanced footer section
    doc.y += 30;
    const footerY = doc.y;

    // Calculate statistics for all students
    const totalStudents = students.length;
    let totalPresentDays = 0;
    let totalPossibleDays = 0;

    // Calculate average attendance across all students
    for (const student of students) {
      const studentAttendance = await Attendance.find({
        student: student._id,
        subject: subject,
        date: {
          $gte: new Date(selectedYear, selectedMonth, 1),
          $lte: new Date(selectedYear, selectedMonth, daysInMonth)
        }
      });
      
      const presentCount = studentAttendance.filter(r => r.status === 'present').length;
      const totalMarkedDays = studentAttendance.length;
      
      totalPresentDays += presentCount;
      totalPossibleDays += Math.max(totalMarkedDays, 1); // Avoid division by zero
    }

    const avgAttendance = totalPossibleDays > 0 ? (totalPresentDays / totalPossibleDays) * 100 : 0;

    // Summary cards
    doc.rect(40, footerY, 200, 80).fill(colors.background);
    doc.rect(40, footerY, 200, 4).fill(colors.primary);
    
    doc.fillColor(colors.text).fontSize(12).font('Helvetica-Bold')
       .text('Attendance Summary', 50, footerY + 15);
    
    doc.fontSize(10).font('Helvetica')
       .text(`Total Students: ${totalStudents}`, 50, footerY + 35)
       .text(`Working Days: ${daysInMonth}`, 50, footerY + 50)
       .text(`Average Attendance: ${avgAttendance.toFixed(1)}%`, 50, footerY + 65);

    // Enhanced legend
    const legendX = 280;
    doc.rect(legendX, footerY, 250, 80).fill(colors.background);
    doc.rect(legendX, footerY, 250, 4).fill(colors.secondary);
    
    doc.fillColor(colors.text).fontSize(12).font('Helvetica-Bold')
       .text('Legend & Grading Scale', legendX + 10, footerY + 15);
    
    doc.fontSize(9).font('Helvetica')
       .fillColor(colors.success).text('● P = Present', legendX + 10, footerY + 35)
       .fillColor(colors.danger).text('● A = Absent', legendX + 80, footerY + 35)
       .fillColor(colors.text).text('● - = No Record', legendX + 150, footerY + 35);
    
    doc.fontSize(8)
       .text('A+ (≥90%) | A (≥80%) | B (≥70%) | C (≥60%) | D (≥50%) | F (<50%)', 
             legendX + 10, footerY + 55);

    // Professional footer
    doc.fontSize(8).fillColor(colors.secondary)
       .text(`Generated on: ${new Date().toLocaleDateString('en-IN', { 
         year: 'numeric', month: 'long', day: 'numeric', 
         hour: '2-digit', minute: '2-digit' 
       })}`, legendX + 10, footerY + 70);

    // Add signature section
    const signatureY = doc.page.height - 80;
    doc.fontSize(10).fillColor(colors.text)
       .text('Faculty Signature: ___________________', 40, signatureY)
       .text('HOD Signature: ___________________', 300, signatureY)
       .text('Date: _______________', 550, signatureY);

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
