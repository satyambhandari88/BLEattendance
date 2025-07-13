const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Use decoded.id instead of decoded._id
    const teacher = await Teacher.findById(decoded.id);

    if (!teacher) {
      return res.status(401).json({ message: 'Token is not valid.' });
    }

    req.user = {
      id: teacher._id,
      name: teacher.name,
      email: teacher.email
    };

    next();
  } catch (error) {
    console.log('Auth middleware error:', error.message);
    res.status(401).json({ message: 'Token is not valid.' });
  }
};

module.exports = auth;
