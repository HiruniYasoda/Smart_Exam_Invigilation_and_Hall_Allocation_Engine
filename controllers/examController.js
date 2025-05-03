const Exam = require('../models/Exam');
const Hall = require('../models/Hall');

// Create a new exam session
exports.createExamSession = async (req, res) => {
  try {
    const exam = await Exam.create(req.body);
    res.status(201).json({ message: 'Exam session created successfully.', exam });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create exam.', error: error.message });
  }
};

// Get all exam sessions
exports.getAllExamSessions = async (req, res) => {
  try {
    const exams = await Exam.find();
    res.status(200).json(exams);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch exams.', error: error.message });
  }
};

// Get exams by department
exports.getExamsByDepartment = async (req, res) => {
  try {
    const department = req.user.department;
    const exams = await Exam.find({ 'subjects.department': department });

    if (exams.length === 0) {
      return res.status(200).json({ exams: [], message: `No exams found for department: ${department}` });
    }

    const examData = [];
    exams.forEach(exam => {
      exam.subjects.forEach(subject => {
        if (subject.department === department) {
          examData.push({
            date: exam.date,
            startTime: exam.startTime,
            endTime: exam.endTime,
            subject: subject.name,
            code: subject.code,
            degreeProgram: subject.department,
            totalCount: subject.studentCount + subject.repeaters
          });
        }
      });
    });

    res.status(200).json({ exams: examData });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch exams.', error: error.message });
  }
};

// Get available halls as buttons
exports.getAvailableHallsAsButtons = async (req, res) => {
  try {
    const { date, startTime, endTime, requiredCount } = req.query;
    const halls = await Hall.find();

    const availableHalls = halls.filter(hall => {
      const hasConflict = hall.bookings?.some(booking =>
        booking.date === date &&
        !(endTime <= booking.startTime || startTime >= booking.endTime)
      );
      return !hasConflict && hall.capacity >= parseInt(requiredCount);
    });

    if (availableHalls.length === 0) {
      return res.status(200).json({ halls: [], message: 'No halls available for the selected time and student count.' });
    }

    res.status(200).json({ halls: availableHalls });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load available halls.', error: error.message });
  }
};

// Update an exam session
exports.updateExamSession = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    res.status(200).json({ message: 'Exam updated successfully.', exam });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update exam.', error: error.message });
  }
};

// Delete an exam session
exports.deleteExamSession = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndDelete(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found.' });
    res.status(200).json({ message: 'Exam deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete exam.', error: error.message });
  }
};
