const mongoose = require('mongoose');

const yearSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});

module.exports = mongoose.model('Year', yearSchema);
