const mongoose = require('mongoose');

const PayRateSchema = new mongoose.Schema({
  supervisorRate: { type: Number, required: true, min: 0, default: 1500 },
  invigilatorRate: { type: Number, required: true, min: 0, default: 1000 },
  currency: { type: String, default: 'LKR', trim: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = mongoose.model('PayRate', PayRateSchema);
