/**
 * Test: New login email only for unknown device/IP
 */
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.ACCESS_TOKEN_SECRET = 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
process.env.JWT_SECRET = 'test-legacy-secret';
process.env.PORT = 0;

let app; let mongoServer;

// Mock email service to inspect calls
let mockSendEmail; // Name prefixed with 'mock' to allow referencing in jest.mock factory
jest.mock('../services/emailService', () => {
  mockSendEmail = jest.fn().mockResolvedValue({ skipped: false });
  return {
    sendEmail: (...args) => mockSendEmail(...args)
  };
});

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  const express = require('express');
  const cookieParser = require('cookie-parser');
  const responseWrapper = require('../middleware/responseWrapper');
  const authRoutes = require('../routes/authRoutes');
  const appInstance = express();
  appInstance.use(express.json());
  appInstance.use(cookieParser());
  appInstance.use(responseWrapper);
  appInstance.use('/api/auth', authRoutes);
  app = appInstance;
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'testdb' });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {await mongoServer.stop();}
});

afterEach(async () => {
  if (mockSendEmail) {mockSendEmail.mockClear();}
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) {await c.deleteMany({});}
});

async function registerUser(email='loginmail@example.com') {
  await request(app).post('/api/auth/register').send({ email, password: 'Password123' });
}

test('first login triggers new device email, second identical login does not', async () => {
  await registerUser('device1@example.com');
  // First login with UA1 + IP1
  await request(app)
    .post('/api/auth/login')
    .set('User-Agent', 'TestAgent/1.0')
    .set('X-Forwarded-For', '10.0.0.1')
    .send({ email: 'device1@example.com', password: 'Password123' })
    .expect(200);
  expect(mockSendEmail).toHaveBeenCalledTimes(1);
  const firstArgs = mockSendEmail.mock.calls[0][0];
  expect(firstArgs.subject).toMatch(/Ny inloggning/i);
  // IP comes from X-Forwarded-For but controller picks it up; ensure the forwarded IP appears OR fallback IPv6 mapped loopback in environments.
  expect(firstArgs.html).toMatch(/10.0.0.1|::ffff:127\.0\.0\.1/);
  expect(firstArgs.html).toMatch(/TestAgent\/1.0/);

  mockSendEmail.mockClear();

  // Second login same UA+IP -> should NOT trigger email
  await request(app)
    .post('/api/auth/login')
    .set('User-Agent', 'TestAgent/1.0')
    .set('X-Forwarded-For', '10.0.0.1')
    .send({ email: 'device1@example.com', password: 'Password123' })
    .expect(200);
  expect(mockSendEmail).not.toHaveBeenCalled();
});

test('different user-agent counts as new device', async () => {
  await registerUser('device2@example.com');
  await request(app)
    .post('/api/auth/login')
    .set('User-Agent', 'AgentA/1')
    .set('X-Forwarded-For', '10.0.0.2')
    .send({ email: 'device2@example.com', password: 'Password123' })
    .expect(200);
  expect(mockSendEmail).toHaveBeenCalledTimes(1);
  mockSendEmail.mockClear();

  await request(app)
    .post('/api/auth/login')
    .set('User-Agent', 'AgentB/2') // changed UA
    .set('X-Forwarded-For', '10.0.0.2')
    .send({ email: 'device2@example.com', password: 'Password123' })
    .expect(200);
  expect(mockSendEmail).toHaveBeenCalledTimes(1); // new device triggers email
});

test('different IP counts as new device', async () => {
  await registerUser('device3@example.com');
  await request(app)
    .post('/api/auth/login')
    .set('User-Agent', 'SameAgent/1')
    .set('X-Forwarded-For', '10.0.0.3')
    .send({ email: 'device3@example.com', password: 'Password123' })
    .expect(200);
  expect(mockSendEmail).toHaveBeenCalledTimes(1);
  mockSendEmail.mockClear();

  await request(app)
    .post('/api/auth/login')
    .set('User-Agent', 'SameAgent/1')
    .set('X-Forwarded-For', '10.0.0.4') // changed IP
    .send({ email: 'device3@example.com', password: 'Password123' })
    .expect(200);
  expect(mockSendEmail).toHaveBeenCalledTimes(1);
});
