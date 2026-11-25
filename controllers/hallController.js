const Hall = require('../models/Hall');

/**
 * Create a new examination hall.
 */
exports.createHall = async (req, res) => {
  try {
    const { name, capacity, location } = req.body;

    if (!name || capacity === undefined || capacity === null || Number(capacity) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Hall name and a positive capacity are required'
      });
    }

    const existing = await Hall.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A hall with this name already exists'
      });
    }

    const hall = await Hall.create({
      name: name.trim(),
      capacity: Number(capacity),
      location: location ? location.trim() : ''
    });

    res.status(201).json({
      success: true,
      message: 'Hall created successfully',
      hall
    });
  } catch (error) {
    console.error('createHall error:', error);
    res.status(500).json({ success: false, message: 'Failed to create hall' });
  }
};

/**
 * Retrieve all examination halls.
 */
exports.getAllHalls = async (req, res) => {
  try {
    const halls = await Hall.find().sort({ name: 1 });
    res.status(200).json({ success: true, halls });
  } catch (error) {
    console.error('getAllHalls error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve halls' });
  }
};

/**
 * Update an examination hall by ID.
 */
exports.updateHall = async (req, res) => {
  try {
    const { name, capacity, location } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name.trim();
    if (capacity !== undefined) {
      if (Number(capacity) <= 0) {
        return res.status(400).json({ success: false, message: 'Capacity must be a positive number' });
      }
      updates.capacity = Number(capacity);
    }
    if (location !== undefined) updates.location = location.trim();

    const hall = await Hall.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!hall) {
      return res.status(404).json({ success: false, message: 'Hall not found' });
    }

    res.status(200).json({ success: true, message: 'Hall updated successfully', hall });
  } catch (error) {
    console.error('updateHall error:', error);
    res.status(500).json({ success: false, message: 'Failed to update hall' });
  }
};

/**
 * Delete an examination hall by ID.
 */
exports.deleteHall = async (req, res) => {
  try {
    const hall = await Hall.findByIdAndDelete(req.params.id);
    if (!hall) {
      return res.status(404).json({ success: false, message: 'Hall not found' });
    }

    res.status(200).json({ success: true, message: 'Hall deleted successfully' });
  } catch (error) {
    console.error('deleteHall error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete hall' });
  }
};
