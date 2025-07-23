const express = require('express');
const { addStudent, addTeacher, addClass, fetchStudents, fetchTeachers, fetchClasses, uploadMiddleware, uploadCSV ,addYear,
  addBranch,
  addSubject,
  addAcademicStructure, getAllYears,
  getAllBranches,
  getAllSubjects,
      getAcademicStructures,
       getTeacherSubjects,
      generateAttendanceRegister,updateYear,deleteYear,updateBranch,
  deleteBranch,updateSubject,
  deleteSubject,updateAcademicStructure,
  deleteAcademicStructure,updateClass,deleteClass,generateSubjectWiseReport,updateStudent,
  deleteStudent} = require('../controllers/adminController');
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


router.get('/all-years', getAllYears);
router.get('/all-branches', getAllBranches);
router.get('/all-subjects', getAllSubjects);
router.post('/add-academic-structure', addAcademicStructure);
router.get('/academic-structures', getAcademicStructures);
router.get('/teacher-subjects/:teacherId/:yearId/:branchId', getTeacherSubjects);
router.post('/generate-register', generateAttendanceRegister);
// Add to adminRoutes.js
router.post('/generate-subject-wise-report', generateSubjectWiseReport);



router.put('/years/:id', updateYear);
router.delete('/years/:id', deleteYear);
router.put('/branches/:id', updateBranch);
router.delete('/branches/:id', deleteBranch);
router.put('/subjects/:id', updateSubject);
router.delete('/subjects/:id', deleteSubject);
router.put('/academic-structures/:id', updateAcademicStructure);
router.delete('/academic-structures/:id', deleteAcademicStructure);
router.put('/classes/:id', updateClass);
router.delete('/classes/:id', deleteClass);
router.put('/update-student/:id', updateStudent);
router.delete('/delete-student/:id', deleteStudent);

module.exports = router;
