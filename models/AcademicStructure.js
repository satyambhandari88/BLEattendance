const mongoose = require('mongoose');

const academicStructureSchema = new mongoose.Schema({
  year: { type: mongoose.Schema.Types.ObjectId, ref: 'Year', required: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }]
});

module.exports = mongoose.model('AcademicStructure', academicStructureSchema);
