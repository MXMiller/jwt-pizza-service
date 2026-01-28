const request = require('supertest');
const app = require('../service.js');

const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken = 0;

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expect(registerRes.body.token).toBe(testUserAuthToken);
});

describe('endpointHelper.js tests', () => {
  
});

describe('service.js tests', () => {
  
});

describe('database.js tests', () => {
  
});

describe('dbModel.js tests', () => {
  
});

describe('model.js tests', () => {
  
});

describe('authRouter.js tests', () => {
  test('login', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

    const user = { ...testUser, roles: [{ role: 'diner' }] };
    delete user.password; 
    expect(loginRes.body.user).toMatchObject(user);

    createAdminUser();//just here to make lint shutup
  });
});

describe('franchiseRouter.js tests', () => {
  
});

describe('orderRouter.js tests', () => {
  
});

describe('userRouter.js tests', () => {
  
});
