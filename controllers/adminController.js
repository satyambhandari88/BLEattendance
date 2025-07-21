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
    // Set aggressive timeout handling for Render
    const RENDER_TIMEOUT = 25000; // Render free tier has 30s limit
    const startTime = Date.now();
    
    // Set response timeout
    res.setTimeout(RENDER_TIMEOUT);
    
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

    console.log(`Starting PDF generation - Time: ${Date.now() - startTime}ms`);

    // Check timeout before expensive operations
    if (Date.now() - startTime > RENDER_TIMEOUT - 5000) {
      return res.status(408).json({ 
        success: false, 
        message: 'Operation approaching timeout limit' 
      });
    }

    // Fetch data with timeout and limits
    const [students, allAttendanceRecords] = await Promise.race([
      Promise.all([
        Student.find({ 
          year: year,
          department: branch 
        }).sort('rollNumber').limit(200).lean(), // Limit students for Render
        
        Attendance.find({
          subject: { $regex: new RegExp(`^${subject}$`, 'i') },
          time: { $gte: startDate, $lte: endDate }
        }).lean()
      ]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 8000)
      )
    ]);

    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No students found for the selected year and branch' 
      });
    }

    // Check if too many students for Render's resources
    if (students.length > 100) {
      return res.status(413).json({
        success: false,
        message: `Too many students (${students.length}). Please limit to 100 students or upgrade server plan.`
      });
    }

    console.log(`Data fetched - Students: ${students.length}, Records: ${allAttendanceRecords.length}, Time: ${Date.now() - startTime}ms`);

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

    // Check timeout before PDF generation
    if (Date.now() - startTime > RENDER_TIMEOUT - 15000) {
      return res.status(408).json({ 
        success: false, 
        message: 'Insufficient time remaining for PDF generation' 
      });
    }

    console.log(`Starting PDF generation - Time: ${Date.now() - startTime}ms`);

    // Create PDF with minimal settings for speed
    const doc = new PDFDocument({ 
      margin: 20, 
      size: 'A4', 
      layout: 'landscape',
      compress: false, // Disable compression for speed
      bufferPages: false // Disable buffering for memory efficiency
    });
    
    const fileName = `attendance_${Date.now()}.pdf`;
    const filePath = path.join('/tmp', fileName); // Use /tmp for Render
    
    // Ensure temp directory exists
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Simplified color palette
    const colors = {
      primary: '#2563eb',
      success: '#16a34a',
      danger: '#dc2626',
      text: '#1f2937',
      light: '#f8fafc',
      border: '#e5e7eb'
    };

    // MINIMAL HEADER - No gradients for speed
    doc.fillColor(colors.primary).fontSize(20).font('Helvetica-Bold');
    doc.text('ATTENDANCE REGISTER', 40, 20);
    
    doc.fillColor(colors.text).fontSize(10).font('Helvetica');
    doc.text(`Subject: ${subject} | Branch: ${branch} | ${monthNames[selectedMonth]} ${selectedYear}`, 40, 45);
    
    // Simple line
    doc.strokeColor(colors.border).lineWidth(1);
    doc.moveTo(40, 65).lineTo(doc.page.width - 40, 65).stroke();

    doc.y = 80;

    // MINIMAL STATISTICS
    let totalPresent = 0;
    let totalMarked = 0;

    // Pre-calculate statistics
    students.forEach(student => {
      const studentAttendance = attendanceByRollNumber.get(student.rollNumber.toString()) || new Map();
      for (let day = 1; day <= daysInMonth; day++) {
        const status = studentAttendance.get(day);
        if (status === 'present') {
          totalPresent++;
          totalMarked++;
        } else if (status === 'absent') {
          totalMarked++;
        }
      }
    });

    const overallPercentage = totalMarked > 0 ? (totalPresent / totalMarked) * 100 : 0;

    // Simple stats text
    doc.fillColor(colors.text).fontSize(10);
    doc.text(`Overall Attendance: ${overallPercentage.toFixed(1)}% | Total Students: ${students.length}`, 40, doc.y);
    doc.y += 25;

    // SIMPLIFIED TABLE
    const pageWidth = doc.page.width - 80;
    const maxDaysToShow = Math.min(daysInMonth, 20); // Limit days for Render
    
    // Calculate column widths
    const availableWidth = pageWidth - 200; // Reserve space for fixed columns
    const dayColWidth = Math.max(15, availableWidth / maxDaysToShow);
    
    const headers = ['#', 'Roll', 'Name', ...Array.from({ length: maxDaysToShow }, (_, i) => (i + 1).toString()), 'P', 'A', '%'];
    const columnWidths = [25, 45, 100, ...Array(maxDaysToShow).fill(dayColWidth), 25, 25, 35];

    // Simple table header
    doc.rect(40, doc.y, pageWidth, 25).fill(colors.light).stroke();
    
    doc.font('Helvetica-Bold').fillColor(colors.text).fontSize(8);
    let x = 40;
    headers.forEach((header, i) => {
      doc.text(header, x + 2, doc.y + 8, { 
        width: columnWidths[i] - 4, 
        align: 'center'
      });
      x += columnWidths[i];
    });

    doc.y += 25;

    // OPTIMIZED STUDENT ROWS - Process in batches
    const rowHeight = 18;
    const batchSize = 20;
    
    for (let batch = 0; batch < students.length; batch += batchSize) {
      // Check timeout every batch
      if (Date.now() - startTime > RENDER_TIMEOUT - 3000) {
        throw new Error('Timeout approaching during PDF generation');
      }

      const batchStudents = students.slice(batch, batch + batchSize);
      
      for (let i = 0; i < batchStudents.length; i++) {
        const student = batchStudents[i];
        const studentIndex = batch + i;
        const studentAttendance = attendanceByRollNumber.get(student.rollNumber.toString()) || new Map();
        
        // Calculate statistics
        let presentCount = 0;
        let absentCount = 0;
        
        for (let day = 1; day <= maxDaysToShow; day++) {
          const status = studentAttendance.get(day);
          if (status === 'present') presentCount++;
          else if (status === 'absent') absentCount++;
        }
        
        const totalMarkedStudent = presentCount + absentCount;
        const percentage = totalMarkedStudent > 0 ? Math.round((presentCount / totalMarkedStudent) * 100) : 0;
        
        const currentY = doc.y;

        // Alternating background
        if (studentIndex % 2 === 0) {
          doc.rect(40, currentY, pageWidth, rowHeight).fill(colors.light);
        }

        // Student data
        x = 40;
        const textY = currentY + 6;
        
        // Serial number
        doc.fillColor(colors.text).fontSize(7).font('Helvetica');
        doc.text((studentIndex + 1).toString(), x + 2, textY, { 
          width: columnWidths[0] - 4, align: 'center' 
        });
        x += columnWidths[0];

        // Roll Number
        doc.text(student.rollNumber.toString(), x + 2, textY, { 
          width: columnWidths[1] - 4, align: 'center' 
        });
        x += columnWidths[1];

        // Student name
        const displayName = student.name.length > 15 ? student.name.substring(0, 15) + '...' : student.name;
        doc.text(displayName, x + 2, textY, { 
          width: columnWidths[2] - 4, align: 'left' 
        });
        x += columnWidths[2];

        // Daily attendance (simplified)
        doc.fontSize(6);
        for (let day = 1; day <= maxDaysToShow; day++) {
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
            doc.fillColor(colors.text).text('-', x + 2, textY, { 
              width: columnWidths[day + 2] - 4, align: 'center' 
            });
          }
          x += columnWidths[day + 2];
        }

        // Summary columns
        doc.fillColor(colors.success).fontSize(7);
        doc.text(presentCount.toString(), x + 2, textY, { 
          width: columnWidths[maxDaysToShow + 3] - 4, align: 'center' 
        });
        x += columnWidths[maxDaysToShow + 3];

        doc.fillColor(colors.danger);
        doc.text(absentCount.toString(), x + 2, textY, { 
          width: columnWidths[maxDaysToShow + 4] - 4, align: 'center' 
        });
        x += columnWidths[maxDaysToShow + 4];

        // Percentage
        const percentColor = percentage >= 75 ? colors.success : 
                            percentage >= 60 ? '#d97706' : colors.danger;
        doc.fillColor(percentColor).fontSize(7);
        doc.text(`${percentage}%`, x + 2, textY, { 
          width: columnWidths[maxDaysToShow + 5] - 4, align: 'center' 
        });

        doc.y = currentY + rowHeight;

        // Page break check (simplified)
        if (doc.y > doc.page.height - 60) {
          doc.addPage({ margin: 20, size: 'A4', layout: 'landscape' });
          doc.y = 40;
        }
      }

      // Yield control between batches
      await new Promise(resolve => setImmediate(resolve));
      console.log(`Processed batch ${Math.floor(batch/batchSize) + 1}/${Math.ceil(students.length/batchSize)} - Time: ${Date.now() - startTime}ms`);
    }

    // MINIMAL FOOTER
    doc.y += 15;
    doc.strokeColor(colors.border).lineWidth(1);
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    
    doc.fillColor(colors.text).fontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')} | Students: ${students.length} | Attendance: ${overallPercentage.toFixed(1)}%`, 
             40, doc.y + 10);

    console.log(`Finalizing PDF - Time: ${Date.now() - startTime}ms`);

    // Finalize PDF
    doc.end();

    // Handle completion with race condition for timeout
    const streamPromise = new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    const timeoutPromise = new Promise((_, reject) => {
      const remaining = RENDER_TIMEOUT - (Date.now() - startTime);
      setTimeout(() => reject(new Error('Final timeout')), Math.max(1000, remaining - 1000));
    });

    try {
      await Promise.race([streamPromise, timeoutPromise]);
      
      const finalTime = Date.now() - startTime;
      console.log(`PDF generation completed in ${finalTime}ms`);

      // Check file exists and has content
      const stats = await fs.promises.stat(filePath);
      if (stats.size === 0) {
        throw new Error('Generated PDF is empty');
      }

      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('Error sending file:', err);
          if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Error sending file' });
          }
        }
        
        // Clean up - non-blocking
        fs.unlink(filePath, (cleanupErr) => {
          if (cleanupErr) console.error('Cleanup error:', cleanupErr);
        });
      });

    } catch (timeoutErr) {
      console.error('PDF generation timeout:', timeoutErr);
      
      // Clean up
      try {
        await fs.promises.unlink(filePath);
      } catch (cleanupErr) {
        console.error('Error cleaning up on timeout:', cleanupErr);
      }

      if (!res.headersSent) {
        res.status(408).json({ 
          success: false, 
          message: 'PDF generation timed out. Try reducing the date range or number of students.' 
        });
      }
    }

  } catch (error) {
    console.error('Error generating attendance register:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Error generating attendance register',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};

// Additional helper function for batch processing large datasets
exports.generateAttendanceRegisterBatch = async (req, res) => {
  try {
    const { year, branch, subject, month, batchNumber = 1, studentsPerBatch = 50 } = req.body;
    
    // This version processes students in smaller batches across multiple requests
    // Frontend can call this multiple times and combine results
    
    const [yearStr, monthStr] = month.split('-');
    const selectedYear = parseInt(yearStr);
    const selectedMonth = parseInt(monthStr) - 1;
    
    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0);

    const totalStudents = await Student.countDocuments({ 
      year: year,
      department: branch 
    });

    const skip = (batchNumber - 1) * studentsPerBatch;
    const students = await Student.find({ 
      year: year,
      department: branch 
    })
    .sort('rollNumber')
    .skip(skip)
    .limit(studentsPerBatch)
    .lean();

    const attendanceRecords = await Attendance.find({
      subject: { $regex: new RegExp(`^${subject}$`, 'i') },
      time: { $gte: startDate, $lte: endDate },
      rollNumber: { $in: students.map(s => s.rollNumber) }
    }).lean();

    res.json({
      success: true,
      students,
      attendanceRecords,
      batchInfo: {
        currentBatch: batchNumber,
        totalBatches: Math.ceil(totalStudents / studentsPerBatch),
        totalStudents,
        studentsInBatch: students.length
      }
    });

  } catch (error) {
    console.error('Error in batch processing:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing batch',
      error: error.message 
    });
  }
};
