const express = require('express');
const { addStudent, addTeacher, addClass, fetchStudents, fetchTeachers, fetchClasses, uploadMiddleware, uploadCSV ,addYear,
  addBranch,
  addSubject,
  addAcademicStructure, getAllYears,
  getAllBranches,
  getAllSubjects } = require('../controllers/adminController');
const router = express.Router();
// const { authenticateAdmin } = require('../middlewares/authMiddleware');


// router.use(authenticateAdmin);

router.get('/students',fetchStudents);
router.get('/teachers',fetchTeachers);
router.get('/classes', fetchClasses);

// Add Student
router.post('/add-student', addStudent);


router.get('/students',fetchStudents);

// Add Teacher
router.post('/add-teacher', addTeacher);

// Add Class
router.post('/add-class', addClass);





router.post('/upload-csv', uploadMiddleware, uploadCSV);

router.post('/add-year', addYear);
router.post('/add-branch', addBranch);
router.post('/add-subject', addSubject);
router.post('/add-academic-structure', addAcademicStructure);

router.get('/all-years', getAllYears);
router.get('/all-branches', getAllBranches);
router.get('/all-subjects', getAllSubjects);
router.get('/academic-structures', getAcademicStructures);

module.exports = router;
