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
const AllClass = require('../models/CreateClass');

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



exports.updateClass = async (req, res) => {
  try {
    console.log('Updating class:', req.params.id);
    const updated = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Class not found' });
    res.json({ message: 'Class updated successfully', class: updated });
  } catch (err) {
    console.error('Error updating class:', err);
    res.status(500).json({ message: 'Update failed', error: err.message });
  }
};


exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Class.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Class not found' });
    res.json({ message: 'Class deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed', error: err.message });
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


// Fetch all years
exports.getAllYears = async (req, res) => {
  try {
    const years = await Year.find();
    res.status(200).json({ success: true, years });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch years', error: err.message });
  }
};


exports.updateYear = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Year name is required' });
    }

    const year = await Year.findByIdAndUpdate(
      id,
      { name },
      { new: true, runValidators: true }
    );

    if (!year) {
      return res.status(404).json({ success: false, message: 'Year not found' });
    }

    res.status(200).json({ success: true, message: 'Year updated successfully', year });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating year', error: err.message });
  }
};

exports.deleteYear = async (req, res) => {
  try {
    const { id } = req.params;
    const year = await Year.findByIdAndDelete(id);

    if (!year) {
      return res.status(404).json({ success: false, message: 'Year not found' });
    }

    res.status(200).json({ success: true, message: 'Year deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting year', error: err.message });
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




// Fetch all branches
exports.getAllBranches = async (req, res) => {
  try {
    const branches = await Branch.find();
    res.status(200).json({ success: true, branches });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch branches', error: err.message });
  }
};


exports.updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Branch name is required' });
    }

    const branch = await Branch.findById(id);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    const existingBranch = await Branch.findOne({ name, _id: { $ne: id } });
    if (existingBranch) {
      return res.status(400).json({ success: false, message: 'Branch name already exists' });
    }

    branch.name = name;
    await branch.save();

    res.json({ success: true, message: 'Branch updated successfully', branch });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Invalid branch ID' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};



exports.deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;

    const branch = await Branch.findById(id);
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    await branch.deleteOne();

    res.json({ success: true, message: 'Branch deleted successfully' });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Invalid branch ID' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
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



// Fetch all subjects
exports.getAllSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().select('_id name'); // Only get id and name
    res.status(200).json({ success: true, subjects });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch subjects', error: err.message });
  }
};



exports.updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Subject name is required' });
    }

    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const existingSubject = await Subject.findOne({ name, _id: { $ne: id } });
    if (existingSubject) {
      return res.status(400).json({ success: false, message: 'Subject name already exists' });
    }

    subject.name = name;
    await subject.save();

    res.json({ success: true, message: 'Subject updated successfully', subject });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Invalid subject ID' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete subject
exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    await subject.deleteOne();

    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Invalid subject ID' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
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


exports.updateAcademicStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const { subjects } = req.body;

    const structure = await AcademicStructure.findByIdAndUpdate(
      id,
      { subjects },
      { new: true }
    )
    .populate('year branch subjects');

    if (!structure) {
      return res.status(404).json({ message: 'Structure not found' });
    }

    res.status(200).json({ message: 'Structure updated', structure });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating structure' });
  }
};


exports.deleteAcademicStructure = async (req, res) => {
  try {
    const { id } = req.params;

    const structure = await AcademicStructure.findByIdAndDelete(id);

    if (!structure) {
      return res.status(404).json({ message: 'Structure not found' });
    }

    res.status(200).json({ message: 'Structure deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting structure' });
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
    const selectedMonth = parseInt(monthStr) - 1; // JavaScript months are 0-indexed
    
    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0);
    const daysInMonth = endDate.getDate();

    // Month names for display
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    console.log('Fetching students and attendance...');

    // OPTIMIZATION 1: Use Promise.all to fetch data in parallel
    const [students, allAttendanceRecords] = await Promise.all([
      Student.find({ 
        year: year,
        department: branch 
      }).sort('rollNumber').lean(), // Use .lean() for better performance
      
      Attendance.find({
        subject: { $regex: new RegExp(`^${subject}$`, 'i') },
        time: { $gte: startDate, $lte: endDate }
      }).lean() // Use .lean() for better performance
    ]);

    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No students found for the selected year and branch' 
      });
    }

    console.log(`Found ${students.length} students and ${allAttendanceRecords.length} attendance records`);

    // OPTIMIZATION 2: Pre-process all attendance data
    const attendanceByRollNumber = new Map();
    const dailyAttendanceStats = new Map();
    
    allAttendanceRecords.forEach(record => {
      const rollNumber = record.rollNumber.toString();
      const recordDate = new Date(record.time);
      const day = recordDate.getDate();
      
      // Group by rollNumber
      if (!attendanceByRollNumber.has(rollNumber)) {
        attendanceByRollNumber.set(rollNumber, new Map());
      }
      attendanceByRollNumber.get(rollNumber).set(day, record.status.toLowerCase());
      
      // Calculate daily stats
      if (!dailyAttendanceStats.has(day)) {
        dailyAttendanceStats.set(day, { present: 0, absent: 0 });
      }
      if (record.status.toLowerCase() === 'present') {
        dailyAttendanceStats.get(day).present++;
      } else {
        dailyAttendanceStats.get(day).absent++;
      }
    });

    console.log('Starting PDF generation...');

    // Generate PDF with optimized settings for more content
    const doc = new PDFDocument({ 
      margin: 25, // Reduced margin for more space
      size: 'A4', 
      layout: 'landscape',
      compress: true // Compress PDF to reduce size
    });
    
    const fileName = `attendance_register_${month}.pdf`;
    const filePath = `./temp/${fileName}`;
    
    // Ensure temp directory exists
    if (!fs.existsSync('./temp')) {
      fs.mkdirSync('./temp', { recursive: true });
    }

    // OPTIMIZATION 3: Use streaming write
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Define colors (simplified for performance)
    const colors = {
      primary: '#2563eb',
      secondary: '#64748b',
      success: '#16a34a',
      danger: '#dc2626',
      background: '#f8fafc',
      border: '#e2e8f0',
      text: '#1e293b',
      lightGray: '#f1f5f9'
    };

    // Function to draw table header
    const drawTableHeader = (startY) => {
      const pageWidth = doc.page.width - 50; // Adjusted for new margins
      
      // Calculate column widths (optimized for more space)
      const dayColWidth = Math.min(18, (pageWidth - 280) / daysInMonth);
      const headers = ['Roll No', 'Name', ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString()), 'P', 'A', '%'];
      const columnWidths = [50, 110, ...Array(daysInMonth).fill(dayColWidth), 20, 20, 30];

      // Table header background
      doc.rect(25, startY, pageWidth, 20).fill(colors.primary);
      doc.font('Helvetica-Bold').fillColor('#ffffff').fontSize(7);
      
      let x = 25;
      headers.forEach((header, i) => {
        doc.text(header, x + 1, startY + 6, { 
          width: columnWidths[i] - 2, 
          align: 'center' 
        });
        x += columnWidths[i];
      });

      return { columnWidths, pageWidth };
    };

    // OPTIMIZED HEADER SECTION
    doc.rect(0, 0, doc.page.width, 80).fill(colors.primary);

    // College Name
    doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
       .text('KAMLA NEHRU INSTITUTE OF TECHNOLOGY', 25, 12, {
         width: doc.page.width - 50,
         align: 'center'
       });

    // Attendance Record heading
    doc.fontSize(14).font('Helvetica-Bold')
       .text('ATTENDANCE RECORD', 25, 32, {
         width: doc.page.width - 50,
         align: 'center'
       });

    // Subject, Branch, Year, Month details
    doc.fontSize(10).font('Helvetica')
       .text(`Subject: ${subject} | Branch: ${branch} | Year: ${year} | Month: ${monthNames[selectedMonth]} ${selectedYear}`, 25, 52, {
         width: doc.page.width - 50,
         align: 'center'
       });

    // Start table after header
    doc.y = 90;
    const tableStartY = doc.y;
    const { columnWidths, pageWidth } = drawTableHeader(tableStartY);

    doc.y = tableStartY + 20;

    // OPTIMIZATION 4: Compact student rows for 50+ students per page
    const rowHeight = 14; // Reduced row height
    const studentsPerPage = Math.floor((doc.page.height - 140) / rowHeight); // Calculate max students per page
    
    console.log(`Calculated ${studentsPerPage} students per page with row height ${rowHeight}`);

    let currentPage = 1;
    let studentsOnCurrentPage = 0;

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const studentAttendance = attendanceByRollNumber.get(student.rollNumber.toString()) || new Map();
      
      // Calculate stats
      let presentCount = 0;
      let absentCount = 0;
      
      for (let day = 1; day <= daysInMonth; day++) {
        const status = studentAttendance.get(day);
        if (status === 'present') presentCount++;
        else if (status === 'absent') absentCount++;
      }
      
      const totalMarked = presentCount + absentCount;
      const percentage = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;

      const currentY = doc.y;

      // Enhanced alternating row colors for better readability
      if (i % 2 === 0) {
        doc.rect(25, currentY, pageWidth, rowHeight).fill(colors.lightGray).stroke();
      } else {
        doc.rect(25, currentY, pageWidth, rowHeight).fillAndStroke('#ffffff', colors.border);
      }

      // Student data with optimized font size
      let x = 25;
      doc.fillColor(colors.text).fontSize(7).font('Helvetica');
      
      // Roll Number
      doc.text(student.rollNumber.toString(), x + 1, currentY + 4, { 
        width: columnWidths[0] - 2, align: 'center' 
      });
      x += columnWidths[0];

      // Name (optimized truncation)
      const displayName = student.name.length > 16 ? student.name.substring(0, 16) + '...' : student.name;
      doc.text(displayName, x + 1, currentY + 4, { 
        width: columnWidths[1] - 2, align: 'left' 
      });
      x += columnWidths[1];

      // Daily attendance with enhanced styling
      for (let day = 1; day <= daysInMonth; day++) {
        const status = studentAttendance.get(day);
        let displayText = '-';
        let textColor = colors.secondary;
        
        if (status === 'present') {
          displayText = 'P';
          textColor = colors.success;
          doc.font('Helvetica-Bold');
        } else if (status === 'absent') {
          displayText = 'A';
          textColor = colors.danger;
          doc.font('Helvetica-Bold');
        } else {
          doc.font('Helvetica');
        }
        
        doc.fillColor(textColor).text(displayText, x + 1, currentY + 4, { 
          width: columnWidths[day + 1] - 2, align: 'center' 
        });
        x += columnWidths[day + 1];
      }

      // Summary columns with enhanced styling
      doc.font('Helvetica-Bold').fillColor(colors.success)
         .text(presentCount.toString(), x + 1, currentY + 4, { 
           width: columnWidths[daysInMonth + 2] - 2, align: 'center' 
         });
      x += columnWidths[daysInMonth + 2];

      doc.fillColor(colors.danger)
         .text(absentCount.toString(), x + 1, currentY + 4, { 
           width: columnWidths[daysInMonth + 3] - 2, align: 'center' 
         });
      x += columnWidths[daysInMonth + 3];

      const percentColor = percentage >= 75 ? colors.success : percentage >= 60 ? '#d97706' : colors.danger;
      doc.fillColor(percentColor)
         .text(`${percentage}%`, x + 1, currentY + 4, { 
           width: columnWidths[daysInMonth + 4] - 2, align: 'center' 
         });

      doc.y = currentY + rowHeight;
      studentsOnCurrentPage++;

      // Page break logic - optimized for 50+ students per page
      if (studentsOnCurrentPage >= 50 || doc.y > doc.page.height - 40) {
        console.log(`Page ${currentPage} completed with ${studentsOnCurrentPage} students`);
        
        if (i < students.length - 1) {
          doc.addPage({ margin: 25, size: 'A4', layout: 'landscape' });
          currentPage++;
          studentsOnCurrentPage = 0;
          
          // Compact header for subsequent pages
          doc.rect(0, 0, doc.page.width, 60).fill(colors.primary);
          
          doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold')
             .text('KNIT - ATTENDANCE RECORD (Continued)', 25, 15, {
               width: doc.page.width - 50,
               align: 'center'
             });
          
          doc.fontSize(9).font('Helvetica')
             .text(`${subject} | ${branch} | ${year} | ${monthNames[selectedMonth]} ${selectedYear} | Page ${currentPage}`, 25, 35, {
               width: doc.page.width - 50,
               align: 'center'
             });
          
          doc.y = 70;
          const headerResult = drawTableHeader(doc.y);
          doc.y += 20;
        }
      }

      // OPTIMIZATION 5: Yield control periodically to prevent blocking
      if (i > 0 && i % 25 === 0) {
        await new Promise(resolve => setImmediate(resolve));
        console.log(`Processed ${i}/${students.length} students`);
      }
    }

    console.log(`PDF generation completed with ${currentPage} pages`);
    console.log('Finalizing PDF...');

    // Finalize PDF (no footer content as requested)
    doc.end();

    // OPTIMIZATION 6: Set up proper error handling and cleanup
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('PDF generation timeout')), 240000); // 4 minute timeout
    });

    const streamPromise = new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    try {
      await Promise.race([streamPromise, timeoutPromise]);
      console.log('PDF generation completed successfully');

      // Send the file
      res.download(filePath, fileName, (err) => {
        if (err) {
          console.error('Error sending file:', err);
          if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Error sending file' });
          }
        }
        
        // Clean up: delete the temporary file
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
      
      // Clean up on timeout
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
    console.error('Error generating attendance register:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        message: 'Error generating attendance register',
        error: error.message 
      });
    }
  }
};






// Add to adminController.js

exports.generateSubjectWiseReport = async (req, res) => {
  try {
    // Set response timeout to 5 minutes
    res.setTimeout(300000);
    
    const { year, branch, startDate, endDate } = req.body;

    console.log('Generating beautiful student-wise report with:', { year, branch, startDate, endDate });

    // Validate required fields
    if (!year || !branch || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Year, branch, start date, and end date are required'
      });
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Step 1: Find all classes for the given year, branch, and date range
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const [classes, allAttendanceRecords] = await Promise.all([
      AllClass.find({
        year: year.toString(),
        branch: branch,
        date: {
          $gte: startStr,
          $lte: endStr
        },
        isActive: true
      }).lean(),
      
      Attendance.find({
        time: {
          $gte: start,
          $lte: end
        }
      }).select('rollNumber subject status classId').lean()
    ]);

    if (classes.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No classes found for Year ${year}, Branch ${branch} between ${startDate} and ${endDate}`
      });
    }

    console.log(`Found ${classes.length} classes`);

    // Step 2: Get all unique subjects
    const subjects = [...new Set(classes.map(cls => cls.subject))].sort();
    console.log('Subjects found:', subjects);

    // Step 3: Get all class IDs
    const classIds = classes.map(cls => cls._id.toString());

    // Filter attendance records for our classes
    const attendanceRecords = allAttendanceRecords.filter(record => 
      classIds.includes(record.classId.toString())
    );

    if (attendanceRecords.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No attendance records found for the specified criteria`
      });
    }

    console.log(`Found ${attendanceRecords.length} attendance records`);

    // Step 4: Get all unique roll numbers
    const rollNumbers = [...new Set(attendanceRecords.map(record => record.rollNumber))].sort();

    // Step 5: Try to get student names from Student model
    let studentNames = {};
    try {
      const students = await Student.find({
        rollNumber: { $in: rollNumbers },
        year: year.toString(),
        department: branch
      }).select('rollNumber name').lean();
      
      studentNames = students.reduce((acc, student) => {
        acc[student.rollNumber] = student.name;
        return acc;
      }, {});
    } catch (error) {
      console.log('Student names not available, using roll numbers only');
    }

    // Step 6: Pre-process attendance data for optimization
    const attendanceByStudent = new Map();
    
    attendanceRecords.forEach(record => {
      const key = `${record.rollNumber}-${record.subject}`;
      if (!attendanceByStudent.has(key)) {
        attendanceByStudent.set(key, { present: 0, total: 0 });
      }
      const stats = attendanceByStudent.get(key);
      stats.total++;
      if (record.status === 'Present') {
        stats.present++;
      }
    });

    // Step 7: Calculate attendance percentages
    const reportData = [];

    for (const rollNumber of rollNumbers) {
      const studentRecord = {
        rollNumber,
        name: studentNames[rollNumber] || `Student ${rollNumber}`,
        subjects: {},
        totalAttendance: 0
      };

      let totalSubjectPercentages = 0;
      let subjectCount = 0;

      for (const subject of subjects) {
        const key = `${rollNumber}-${subject}`;
        const stats = attendanceByStudent.get(key);

        if (stats && stats.total > 0) {
          const percentage = Math.round((stats.present / stats.total) * 100 * 100) / 100;
          
          studentRecord.subjects[subject] = {
            percentage,
            present: stats.present,
            total: stats.total
          };

          totalSubjectPercentages += percentage;
          subjectCount++;
        } else {
          studentRecord.subjects[subject] = {
            percentage: 0,
            present: 0,
            total: 0
          };
        }
      }

      studentRecord.totalAttendance = subjectCount > 0 
        ? Math.round((totalSubjectPercentages / subjectCount) * 100) / 100 
        : 0;

      reportData.push(studentRecord);
    }

    // Sort by roll number
    reportData.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

    console.log(`Generated report for ${reportData.length} students`);

    // Step 8: Generate Beautiful PDF with Table Layout
    const doc = new PDFDocument({ 
      margin: 25,
      size: 'A4', 
      layout: 'landscape',
      compress: true
    });

    const fileName = `Student_Attendance_Report_${year}_${branch.replace(/\s+/g, '_')}_${new Date().getFullYear()}.pdf`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    // Pipe the PDF to response
    doc.pipe(res);

    // Enhanced Color palette
    const colors = {
      primary: '#2563eb',      // Modern blue
      secondary: '#64748b',    // Slate gray
      accent: '#06b6d4',       // Cyan
      success: '#16a34a',      // Emerald
      warning: '#d97706',      // Amber
      danger: '#dc2626',       // Red
      light: '#f8fafc',        // Very light gray
      lightGray: '#f1f5f9',    // Light gray for alternating rows
      border: '#e2e8f0',       // Border gray
      dark: '#0f172a',         // Dark slate
      white: '#ffffff'
    };

    // Helper function to draw beautiful header background
    const drawHeaderBackground = (doc, x, y, width, height) => {
      // Primary background
      doc.rect(x, y, width, height).fill(colors.primary);
      
      // Add subtle gradient effect with overlay
      doc.rect(x, y, width, height/2)
         .fillOpacity(0.3)
         .fill(colors.accent)
         .fillOpacity(1);
    };

    // Function to draw table header
    const drawTableHeader = (startY) => {
      const pageWidth = doc.page.width - 50; // Account for margins
      
      // Calculate optimal column widths
      const rollNoWidth = 60;
      const nameWidth = 120;
      const avgWidth = 60;
      const subjectWidth = Math.min(70, (pageWidth - rollNoWidth - nameWidth - avgWidth) / subjects.length);
      
      const headers = ['Roll No', 'Student Name', ...subjects, 'Average'];
      const columnWidths = [rollNoWidth, nameWidth, ...Array(subjects.length).fill(subjectWidth), avgWidth];

      // Beautiful header background with gradient
      drawHeaderBackground(doc, 25, startY, pageWidth, 25);
      
      // Header border
      doc.rect(25, startY, pageWidth, 25)
         .lineWidth(2)
         .strokeOpacity(0.3)
         .stroke(colors.accent);

      // Header text with enhanced styling
      doc.font('Helvetica-Bold').fillColor(colors.white).fontSize(9);
      
      let x = 25;
      headers.forEach((header, i) => {
        const displayHeader = header.length > 8 ? header.substring(0, 8) + '..' : header;
        doc.text(displayHeader, x + 2, startY + 8, { 
          width: columnWidths[i] - 4, 
          align: 'center' 
        });
        x += columnWidths[i];
      });

      return { columnWidths, pageWidth };
    };

    // MAIN HEADER SECTION
    drawHeaderBackground(doc, 0, 0, doc.page.width, 85);

    // Add decorative border to header
    doc.rect(0, 0, doc.page.width, 85)
       .lineWidth(3)
       .strokeOpacity(0.4)
       .stroke(colors.accent);

    // College Name
    doc.fillColor(colors.white).fontSize(18).font('Helvetica-Bold')
       .text('KAMLA NEHRU INSTITUTE OF TECHNOLOGY', 25, 15, {
         width: doc.page.width - 50,
         align: 'center'
       });

    // Report Title
    doc.fontSize(14).font('Helvetica-Bold')
       .text('📊 STUDENT-WISE ATTENDANCE ANALYTICS REPORT', 25, 38, {
         width: doc.page.width - 50,
         align: 'center'
       });

    // Format date helper
    const formatDate = (dateStr) => {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    };

    // Report details
    doc.fontSize(10).font('Helvetica')
       .text(`Branch: ${branch} | Year: ${year} | Period: ${formatDate(startDate)} → ${formatDate(endDate)} | Generated: ${new Date().toLocaleDateString()}`, 25, 58, {
         width: doc.page.width - 50,
         align: 'center'
       });

    // PERFORMANCE LEGEND
    doc.y = 95;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.dark);
    doc.text('PERFORMANCE INDICATORS:', 25, doc.y);
    
    const legendY = doc.y + 12;
    const legendItems = [
      { color: colors.success, text: '90-100% Excellent ★', symbol: '●' },
      { color: colors.primary, text: '80-89% Good ▲', symbol: '●' },
      { color: colors.warning, text: '70-79% Average ●', symbol: '●' },
      { color: colors.danger, text: 'Below 70% Needs Attention ▼', symbol: '●' }
    ];

    let legendX = 25;
    legendItems.forEach(item => {
      doc.fillColor(item.color).text(item.symbol, legendX, legendY);
      doc.fillColor(colors.dark).fontSize(8).text(item.text, legendX + 12, legendY);
      legendX += 160;
    });

    // Start table
    doc.y = legendY + 25;
    const tableStartY = doc.y;
    const { columnWidths, pageWidth } = drawTableHeader(tableStartY);

    doc.y = tableStartY + 25;

    // Calculate optimal row height and students per page
    const rowHeight = 16;
    const studentsPerPage = Math.floor((doc.page.height - 160) / rowHeight);
    
    console.log(`Calculated ${studentsPerPage} students per page with row height ${rowHeight}`);

    let currentPage = 1;
    let studentsOnCurrentPage = 0;

    // TABLE ROWS
    for (let i = 0; i < reportData.length; i++) {
      const student = reportData[i];
      const currentY = doc.y;

      // Enhanced alternating row colors
      if (i % 2 === 0) {
        doc.rect(25, currentY, pageWidth, rowHeight)
           .fill(colors.lightGray);
      } else {
        doc.rect(25, currentY, pageWidth, rowHeight)
           .fill(colors.white);
      }

      // Row border
      doc.rect(25, currentY, pageWidth, rowHeight)
         .lineWidth(0.5)
         .strokeOpacity(0.2)
         .stroke(colors.border);

      // Student data with enhanced styling
      let x = 25;
      doc.fillColor(colors.dark).fontSize(8).font('Helvetica');

      // Roll Number
      doc.text(student.rollNumber, x + 2, currentY + 5, { 
        width: columnWidths[0] - 4, 
        align: 'center' 
      });
      x += columnWidths[0];

      // Name
      const displayName = student.name.length > 18 ? student.name.substring(0, 15) + '...' : student.name;
      doc.text(displayName, x + 2, currentY + 5, { 
        width: columnWidths[1] - 4, 
        align: 'left' 
      });
      x += columnWidths[1];

      // Subject percentages with enhanced color coding
      subjects.forEach((subject, subjectIndex) => {
        const subjectData = student.subjects[subject];
        const percentage = subjectData ? subjectData.percentage : 0;
        
        // Enhanced color coding with symbols
        let textColor = colors.dark;
        let symbol = '';
        let fontWeight = 'Helvetica';
        
        if (percentage >= 90) {
          textColor = colors.success;
          symbol = '★';
          fontWeight = 'Helvetica-Bold';
        } else if (percentage >= 80) {
          textColor = colors.primary;
          symbol = '▲';
          fontWeight = 'Helvetica-Bold';
        } else if (percentage >= 70) {
          textColor = colors.warning;
          symbol = '●';
          fontWeight = 'Helvetica-Bold';
        } else if (percentage > 0) {
          textColor = colors.danger;
          symbol = '▼';
          fontWeight = 'Helvetica-Bold';
        }

        doc.fillColor(textColor).font(fontWeight);
        const displayText = percentage > 0 ? `${symbol}${percentage}%` : '-';
        doc.text(displayText, x + 2, currentY + 5, { 
          width: columnWidths[subjectIndex + 2] - 4, 
          align: 'center' 
        });
        x += columnWidths[subjectIndex + 2];
      });

      // Average with premium styling
      const avgPercentage = student.totalAttendance;
      let avgColor = colors.dark;
      let avgSymbol = '';
      let avgFont = 'Helvetica';
      
      if (avgPercentage >= 90) {
        avgColor = colors.success;
        avgSymbol = '★';
        avgFont = 'Helvetica-Bold';
      } else if (avgPercentage >= 80) {
        avgColor = colors.primary;
        avgSymbol = '▲';
        avgFont = 'Helvetica-Bold';
      } else if (avgPercentage >= 70) {
        avgColor = colors.warning;
        avgSymbol = '●';
        avgFont = 'Helvetica-Bold';
      } else if (avgPercentage > 0) {
        avgColor = colors.danger;
        avgSymbol = '▼';
        avgFont = 'Helvetica-Bold';
      }

      doc.fillColor(avgColor).font(avgFont);
      const avgDisplay = avgPercentage > 0 ? `${avgSymbol}${avgPercentage}%` : '-';
      doc.text(avgDisplay, x + 2, currentY + 5, { 
        width: columnWidths[columnWidths.length - 1] - 4, 
        align: 'center' 
      });

      doc.y = currentY + rowHeight;
      studentsOnCurrentPage++;

      // Enhanced page break logic
      if (studentsOnCurrentPage >= studentsPerPage || doc.y > doc.page.height - 60) {
        console.log(`Page ${currentPage} completed with ${studentsOnCurrentPage} students`);
        
        if (i < reportData.length - 1) {
          doc.addPage({ margin: 25, size: 'A4', layout: 'landscape' });
          currentPage++;
          studentsOnCurrentPage = 0;
          
          // Compact header for subsequent pages
          drawHeaderBackground(doc, 0, 0, doc.page.width, 65);
          
          doc.fillColor(colors.white).fontSize(14).font('Helvetica-Bold')
             .text('KNIT - STUDENT ATTENDANCE REPORT (Continued)', 25, 15, {
               width: doc.page.width - 50,
               align: 'center'
             });
          
          doc.fontSize(9).font('Helvetica')
             .text(`${branch} | ${year} | ${formatDate(startDate)} → ${formatDate(endDate)} | Page ${currentPage}`, 25, 35, {
               width: doc.page.width - 50,
               align: 'center'
             });
          
          doc.y = 75;
          const headerResult = drawTableHeader(doc.y);
          doc.y += 25;
        }
      }

      // Yield control periodically to prevent blocking
      if (i > 0 && i % 20 === 0) {
        await new Promise(resolve => setImmediate(resolve));
        console.log(`Processed ${i}/${reportData.length} students`);
      }
    }

    // ENHANCED FOOTER SECTION
    doc.y += 15;
    
    // Calculate comprehensive statistics
    const excellentStudents = reportData.filter(s => s.totalAttendance >= 90).length;
    const goodStudents = reportData.filter(s => s.totalAttendance >= 80 && s.totalAttendance < 90).length;
    const averageStudents = reportData.filter(s => s.totalAttendance >= 70 && s.totalAttendance < 80).length;
    const needsAttention = reportData.filter(s => s.totalAttendance < 70).length;
    const overallAvg = reportData.length > 0 
      ? Math.round((reportData.reduce((sum, student) => sum + student.totalAttendance, 0) / reportData.length) * 100) / 100 
      : 0;

    // Statistics background
    const statsHeight = 70;
    doc.rect(25, doc.y, pageWidth, statsHeight)
       .fillOpacity(0.05)
       .fill(colors.primary)
       .fillOpacity(1);

    doc.rect(25, doc.y, pageWidth, statsHeight)
       .lineWidth(1)
       .strokeOpacity(0.3)
       .stroke(colors.primary);

    // Statistics title
    doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary);
    doc.text('📈 COMPREHENSIVE ATTENDANCE ANALYTICS', 35, doc.y + 10);

    // Statistics content
    doc.fontSize(9).font('Helvetica').fillColor(colors.dark);
    
    const statsY = doc.y + 28;
    doc.text(`★ Excellent Performance (90-100%): ${excellentStudents} students (${Math.round((excellentStudents/reportData.length)*100)}%)`, 35, statsY);
    doc.text(`▲ Good Performance (80-89%): ${goodStudents} students (${Math.round((goodStudents/reportData.length)*100)}%)`, 280, statsY);
    doc.text(`● Average Performance (70-79%): ${averageStudents} students (${Math.round((averageStudents/reportData.length)*100)}%)`, 525, statsY);
    
    doc.text(`▼ Needs Attention (<70%): ${needsAttention} students (${Math.round((needsAttention/reportData.length)*100)}%)`, 35, statsY + 15);
    doc.text(`📊 Overall Class Average: ${overallAvg}%`, 280, statsY + 15);
    doc.text(`📚 Total Subjects Analyzed: ${subjects.length}`, 525, statsY + 15);

    // Professional footer
    doc.y += statsHeight + 10;
    doc.fontSize(7).font('Helvetica').fillColor(colors.secondary);
    doc.text(`Generated by Academic Management System v2.0 | ${new Date().toLocaleString()} | Confidential Document`, 
             25, doc.y, { align: 'center', width: pageWidth });

    console.log(`PDF generation completed with ${currentPage} pages`);

    // Finalize the PDF
    doc.end();

  } catch (error) {
    console.error('Error generating beautiful student-wise report:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate report',
        error: error.message
      });
    }
  }
};
