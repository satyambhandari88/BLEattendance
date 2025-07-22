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
// Teacher Login
router.post('/teacher/login', async (req, res) => {
  const { email, id, password } = req.body;

  try {
    const teacher = await Teacher.findOne({ email, id });
    if (teacher && (await bcrypt.compare(password, teacher.password))) {
      const token = generateToken(teacher._id);

      // ✅ Return teacher info under 'teacher' key
      res.json({
        token,
        teacher: {
          _id: teacher.id,
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
  const { rollNumber, email, password } = req.body;
  const deviceId = req.headers['x-device-id']; // capture device ID

  if (!deviceId) {
    return res.status(400).json({ message: 'Device ID is required' });
  }

  try {
    const student = await Student.findOne({ rollNumber, email });

    if (!student || student.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // First time login: save device ID
    if (!student.deviceId) {
      student.deviceId = deviceId;
      await student.save();
    } else if (student.deviceId !== deviceId) {
      return res.status(403).json({ message: 'This account is already registered on another device' });
    }

    res.json({
      _id: student._id,
      name: student.name,
      email: student.email,
      rollNumber: student.rollNumber,
      department: student.department,
      year: student.year,
      token: generateToken(student._id),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
