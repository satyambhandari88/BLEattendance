const mongoose = require('mongoose');

const FaceDescriptorSchema = new mongoose.Schema(
  {
    vector: {
      type: [Number], // 128-d or 512-d depending on model; here we use 128-d (face-api)
      required: true,
    },
    ts: { type: Date, default: Date.now },
    sourceStep: { type: String, default: 'look_center' },
    quality: { type: Number, default: 0 },
  },
  { _id: false }
);

const StudentSchema = new mongoose.Schema(
  {
    rollNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    department: { type: String, required: true },
    year: { type: Number, required: true },

    // === Face enrollment / verification ===
    faceEnrolled: { type: Boolean, default: false },
    faceEnrollmentData: {
      samples: { type: Number, default: 0 },
      avgQuality: { type: Number, default: 0 },
      version: { type: String, default: 'face-api@1' },
      enrollmentDate: { type: Date, default: null },
    },
    faceDescriptors: { type: [FaceDescriptorSchema], default: [] }, // multiple templates

    verificationStats: {
      totalAttempts: { type: Number, default: 0 },
      successfulVerifications: { type: Number, default: 0 },
      lastVerified: { type: Date, default: null },
      averageSimilarity: { type: Number, default: 0 }, // mean of (1 - distance)
    },
  },
  { timestamps: true }
);

// ===== Instance helpers =====
StudentSchema.methods.hasFaceEnrolled = function () {
  return this.faceEnrolled && Array.isArray(this.faceDescriptors) && this.faceDescriptors.length > 0;
};

StudentSchema.methods.setFaceDescriptors = function (descriptors = [], meta = {}) {
  this.faceDescriptors = descriptors.map((d) => ({
    vector: Array.from(d.vector || d), // accept raw arrays too
    ts: d.ts || new Date(),
    sourceStep: d.sourceStep || 'look_center',
    quality: typeof d.quality === 'number' ? d.quality : 0,
  }));
  this.faceEnrolled = this.faceDescriptors.length > 0;
  this.faceEnrollmentData = {
    samples: this.faceDescriptors.length,
    avgQuality:
      this.faceDescriptors.length === 0
        ? 0
        : this.faceDescriptors.reduce((s, x) => s + (x.quality || 0), 0) / this.faceDescriptors.length,
    version: meta.version || 'face-api@1',
    enrollmentDate: new Date(),
  };
};

StudentSchema.methods.updateVerificationStats = async function (similarity, success) {
  // similarity = 1 - distance (so higher is better, range ~ [0,1])
  this.verificationStats.totalAttempts += 1;
  if (success) this.verificationStats.successfulVerifications += 1;

  // incremental average
  const n = this.verificationStats.totalAttempts;
  const prevAvg = this.verificationStats.averageSimilarity || 0;
  this.verificationStats.averageSimilarity = prevAvg + (similarity - prevAvg) / n;
  this.verificationStats.lastVerified = new Date();
  return this.save();
};

StudentSchema.methods.getVerificationSuccessRate = function () {
  const { totalAttempts, successfulVerifications } = this.verificationStats || {};
  if (!totalAttempts) return 0;
  return successfulVerifications / totalAttempts;
};

module.exports = mongoose.model('Student', StudentSchema);
