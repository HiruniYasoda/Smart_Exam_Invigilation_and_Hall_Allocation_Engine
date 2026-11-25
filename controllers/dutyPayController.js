const PayRate = require('../models/PayRate');
const AssignmentRequest = require('../models/AssignmentRequest');
const Lecturer = require('../models/Lecturer');

/**
 * Retrieve current duty pay rates (creates defaults if none exist).
 */
exports.getPayRates = async (req, res) => {
  try {
    let rates = await PayRate.findOne().sort({ updatedAt: -1 });
    if (!rates) {
      rates = await PayRate.create({ supervisorRate: 1500, invigilatorRate: 1000, currency: 'LKR' });
    }
    res.status(200).json({ success: true, rates });
  } catch (error) {
    console.error('getPayRates error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve pay rates' });
  }
};

/**
 * Update duty pay rates (Admin only).
 */
exports.updatePayRates = async (req, res) => {
  try {
    const { supervisorRate, invigilatorRate, currency = 'LKR' } = req.body;

    if (
      supervisorRate === undefined ||
      invigilatorRate === undefined ||
      Number(supervisorRate) < 0 ||
      Number(invigilatorRate) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Non-negative supervisorRate and invigilatorRate are required'
      });
    }

    let rates = await PayRate.findOne().sort({ updatedAt: -1 });
    if (rates) {
      rates.supervisorRate = Number(supervisorRate);
      rates.invigilatorRate = Number(invigilatorRate);
      rates.currency = currency.trim() || 'LKR';
      rates.updatedBy = req.user._id || req.user.id;
      await rates.save();
    } else {
      rates = await PayRate.create({
        supervisorRate: Number(supervisorRate),
        invigilatorRate: Number(invigilatorRate),
        currency: currency.trim() || 'LKR',
        updatedBy: req.user._id || req.user.id
      });
    }

    res.status(200).json({ success: true, message: 'Pay rates updated successfully', rates });
  } catch (error) {
    console.error('updatePayRates error:', error);
    res.status(500).json({ success: false, message: 'Failed to update pay rates' });
  }
};

/**
 * Calculate per-lecturer duty counts and payout totals.
 */
exports.getDutyPaySummary = async (req, res) => {
  try {
    const { status } = req.query;
    let rates = await PayRate.findOne().sort({ updatedAt: -1 }).lean();
    if (!rates) {
      rates = { supervisorRate: 1500, invigilatorRate: 1000, currency: 'LKR' };
    }

    const filter = status ? { status } : { status: { $in: ['Assigned', 'Accepted', 'Finished'] } };
    const [assignments, lecturers] = await Promise.all([
      AssignmentRequest.find(filter).lean(),
      Lecturer.find().lean()
    ]);

    const tally = new Map();
    lecturers.forEach(l => {
      tally.set(l._id.toString(), {
        lecturerId: l._id,
        name: l.name,
        email: l.email,
        department: l.department,
        rank: l.rank,
        supervisorDuties: 0,
        invigilatorDuties: 0,
        totalPay: 0
      });
    });

    for (const assignment of assignments) {
      for (const supId of (assignment.supervisors || [])) {
        const entry = tally.get(supId.toString());
        if (entry) entry.supervisorDuties += 1;
      }
      for (const invId of (assignment.invigilators || [])) {
        const entry = tally.get(invId.toString());
        if (entry) entry.invigilatorDuties += 1;
      }
    }

    const summary = Array.from(tally.values()).map(item => ({
      ...item,
      totalPay:
        item.supervisorDuties * rates.supervisorRate +
        item.invigilatorDuties * rates.invigilatorRate
    }));

    res.status(200).json({ success: true, rates, summary });
  } catch (error) {
    console.error('getDutyPaySummary error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate duty pay summary' });
  }
};
