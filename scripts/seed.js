/**
 * Database Seeder: Seeds realistic academic data for local development & evaluation.
 * Run with: npm run seed
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const validateEnv = require('../config/env');
const config = validateEnv();

const User = require('../models/User');
const Lecturer = require('../models/Lecturer');
const Hall = require('../models/Hall');
const Exam = require('../models/Exam');
const AssignmentRequest = require('../models/AssignmentRequest');
const { hashPassword } = require('../utils/passwordUtils');

async function seedDatabase() {
  console.log('Connecting to MongoDB at:', config.MONGO_URI);
  await mongoose.connect(config.MONGO_URI);
  console.log('Connected to MongoDB. Starting database seed...');

  try {
    // 1. Clear existing collections
    await User.deleteMany({});
    await Lecturer.deleteMany({});
    await Hall.deleteMany({});
    await Exam.deleteMany({});
    await AssignmentRequest.deleteMany({});
    console.log('Cleared existing records.');

    // 2. Seed Users
    const defaultPassword = await hashPassword('Password123!');
    const users = await User.create([
      {
        username: 'admin',
        email: 'admin@susl.ac.lk',
        password: defaultPassword,
        role: 'admin',
        department: 'Academic Affairs'
      },
      {
        username: 'prof_silva',
        email: 'silva@susl.ac.lk',
        password: defaultPassword,
        role: 'lecturer',
        department: 'Computing'
      },
      {
        username: 'dr_fernando',
        email: 'fernando@susl.ac.lk',
        password: defaultPassword,
        role: 'lecturer',
        department: 'Computing'
      },
      {
        username: 'mr_kumara',
        email: 'kumara@susl.ac.lk',
        password: defaultPassword,
        role: 'lecturer',
        department: 'Computing'
      },
      {
        username: 'student_sam',
        email: 'sam@student.susl.ac.lk',
        password: defaultPassword,
        role: 'student',
        department: 'Computing'
      }
    ]);
    console.log(`Seeded ${users.length} user accounts.`);

    // 3. Seed Lecturers with Seniority Ranks
    const lecturers = await Lecturer.create([
      {
        name: 'Prof. K. Silva',
        email: 'silva@susl.ac.lk',
        department: 'Computing',
        rank: 'Professor',
        dutyCount: 2,
        availability: [
          { date: '2026-12-10', startTime: '08:00', endTime: '17:00' },
          { date: '2026-12-11', startTime: '08:00', endTime: '17:00' }
        ]
      },
      {
        name: 'Dr. M. Fernando',
        email: 'fernando@susl.ac.lk',
        department: 'Computing',
        rank: 'Senior Lecturer Gr (I)',
        dutyCount: 3,
        availability: [
          { date: '2026-12-10', startTime: '08:00', endTime: '17:00' }
        ]
      },
      {
        name: 'Dr. P. Perera',
        email: 'perera@susl.ac.lk',
        department: 'Computing',
        rank: 'Senior Lecturer Gr (II)',
        dutyCount: 1,
        availability: [
          { date: '2026-12-10', startTime: '08:00', endTime: '12:00' }
        ]
      },
      {
        name: 'Mr. A. Kumara',
        email: 'kumara@susl.ac.lk',
        department: 'Computing',
        rank: 'Lecturer',
        dutyCount: 4,
        availability: [
          { date: '2026-12-10', startTime: '08:00', endTime: '17:00' }
        ]
      },
      {
        name: 'Ms. N. Jayasinghe',
        email: 'jayasinghe@susl.ac.lk',
        department: 'Computing',
        rank: 'Lecturer (Probationary)',
        dutyCount: 0,
        availability: [
          { date: '2026-12-10', startTime: '08:00', endTime: '17:00' }
        ]
      }
    ]);
    console.log(`Seeded ${lecturers.length} lecturers with academic seniority ranks.`);

    // 4. Seed Examination Halls
    const halls = await Hall.create([
      {
        name: 'Main Auditorium',
        capacity: 250,
        location: 'Administration Complex',
        bookings: []
      },
      {
        name: 'Computing Hall 01',
        capacity: 100,
        location: 'Faculty of Computing',
        bookings: [
          {
            date: '2026-12-09',
            startTime: '09:00',
            endTime: '11:00',
            subject: 'Orientation'
          }
        ]
      },
      {
        name: 'Lecture Theatre B',
        capacity: 50,
        location: 'Academic Block 2',
        bookings: []
      }
    ]);
    console.log(`Seeded ${halls.length} examination halls.`);

    // 5. Seed Exam Sessions
    const exams = await Exam.create([
      {
        date: '2026-12-10',
        startTime: '09:00',
        endTime: '11:00',
        status: 'Open',
        subjects: [
          {
            name: 'Software Architecture',
            code: 'CS301',
            department: 'Computing',
            studentCount: 80,
            repeaters: 5,
            assignedHall: 'Computing Hall 01',
            setterId: lecturers[0]._id
          },
          {
            name: 'Database Engineering',
            code: 'CS302',
            department: 'Computing',
            studentCount: 35,
            repeaters: 0,
            setterId: lecturers[1]._id
          }
        ]
      },
      {
        date: '2026-12-11',
        startTime: '13:00',
        endTime: '15:00',
        status: 'Open',
        subjects: [
          {
            name: 'Algorithms & Complexity',
            code: 'CS204',
            department: 'Computing',
            studentCount: 190,
            repeaters: 10,
            setterId: lecturers[0]._id
          }
        ]
      }
    ]);
    console.log(`Seeded ${exams.length} examination sessions with multi-subject requirements.`);

    console.log('\n=========================================');
    console.log('DATABASE SEED COMPLETED SUCCESSFULLY');
    console.log('=========================================');
    console.log('Demo Credentials for Evaluation:');
    console.log(' - Admin:    Username: admin       | Password: Password123!');
    console.log(' - Lecturer: Username: prof_silva  | Password: Password123!');
    console.log(' - Lecturer: Username: dr_fernando | Password: Password123!');
    console.log(' - Student:  Username: student_sam | Password: Password123!');
    console.log('=========================================\n');
  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
