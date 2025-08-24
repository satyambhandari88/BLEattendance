const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');


const router = express.Router();

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};






// Admin Registration Route
router.post('/admin/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    console.log('Request Body:', req.body); // Log incoming data
    const adminExists = await Admin.findOne({ email });
    if (adminExists) {
      console.log('Admin already exists');
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const admin = new Admin({ name, email, password });
    await admin.save();

    res.status(201).json({
      _id: admin.id,
      name: admin.name,
      email: admin.email,
      token: generateToken(admin.id),
    });
  } catch (error) {
    console.error('Error during registration:', error.message); // Log the error
    res.status(500).json({ message: 'Server error occurred' });
  }
});




// Admin Login
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email });
    if (admin && (await bcrypt.compare(password, admin.password))) {
      res.json({
        _id: admin.id,
        name: admin.name,
        email: admin.email,
        token: generateToken(admin.id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Teacher Login
router.post('/teacher/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const teacher = await Teacher.findOne({ email }); // Removed id
    if (teacher && (await bcrypt.compare(password, teacher.password))) {
      const token = generateToken(teacher._id);

      res.json({
        token,
        teacher: {
          _id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          department: teacher.department,
        },
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// Student Login
router.post('/student/login', async (req, res) => {
  const { rollNumber, email, password, deviceId } = req.body;

  try {
    if (!rollNumber || !email || !password || !deviceId) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const student = await Student.findOne({ 
      rollNumber: rollNumber.trim(), 
      email: email.toLowerCase().trim() 
    });
    
    if (!student) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordCorrect = await student.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Device binding logic
    const deviceUsedByAnother = await Student.findOne({ deviceId, _id: { $ne: student._id } });

    if (student.deviceId && student.deviceId !== deviceId) {
      return res.status(403).json({ message: 'Your account is locked to another device.' });
    }

    if (!student.deviceId && deviceUsedByAnother) {
      return res.status(403).json({ message: 'This device is already assigned to another student.' });
    }

    if (!student.deviceId) {
      student.deviceId = deviceId;
      student.lastLoginAt = new Date();
      await student.save();
    } else {
      await Student.findByIdAndUpdate(student._id, { lastLoginAt: new Date() });
    }

    const faceEnrollmentCompleted = student.isFaceEnrolled();

    res.status(200).json({
      _id: student._id,
      name: student.name,
      email: student.email,
      rollNumber: student.rollNumber,
      department: student.department,
      year: student.year,
      token: generateToken(student._id),
      deviceId: student.deviceId,
      faceEnrollmentCompleted
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});



module.exports = router;

