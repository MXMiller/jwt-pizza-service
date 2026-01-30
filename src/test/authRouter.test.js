const request = require('supertest');
const app = require('../service.js');
const { Role } = require('../database/database.js');

describe('authRouter.js tests', () => {
  let testUserAuthToken = 0;

  beforeAll(async () => {
    const testUser = { name: 'pizza diner', email: Math.random().toString(36).substring(2, 12) + '@test.com', password: 'a' };
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    expect(registerRes.body.token).toBe(testUserAuthToken);
  });

  test('post / register registers new user', async () => {
    const registerRes = await request(app).post('/api/auth').send({
      name: 'another pizza diner',
      email: Math.random().toString(36).substring(2, 12) + '@test.com',
      password: 'a',
    });
    expect(registerRes.status).toBe(200);
    expect(registerRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

    const user = { name: 'another pizza diner', email: registerRes.body.user.email, roles: [{ role: 'diner' }] };
    delete user.password; 
    expect(registerRes.body.user).toMatchObject(user);
  });

  test('post. / register when invalid user throws error', async () => {
    const noPasswordRegisterRes = await request(app).post('/api/auth').send({
      name: 'another pizza diner',
      email: Math.random().toString(36).substring(2, 12) + '@test.com',
    });
    expect(noPasswordRegisterRes.status).toBe(400);
    expect(noPasswordRegisterRes.body.message).toBe('name, email, and password are required');

    const nullFieldsRegisterRes = await request(app).post('/api/auth').send({
      name: null,
      email: null,
      password: null,
    });
    expect(nullFieldsRegisterRes.status).toBe(400);
    expect(nullFieldsRegisterRes.body.message).toBe('name, email, and password are required');

    const nullRegisterRes = await request(app).post('/api/auth').send({ });
    expect(nullRegisterRes.status).toBe(400);
    expect(nullRegisterRes.body.message).toBe('name, email, and password are required');
  });

  test('put / login valid user works', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'login test user',
      email: userEmail,
      password: 'password',
    });
    expect(registerRes.status).toBe(200);

    const res = await request(app).put('/api/auth').send({ email: userEmail, password: 'password' });
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
    expect(res.body.user).toHaveProperty('email', userEmail);
    expect(res.body.user).toHaveProperty('name', 'login test user');
    expect(res.body.user).toHaveProperty('roles');
  });

  test('put / login invalid user throws error', async () => {
    const res = await request(app).put('/api/auth').send({ email: 'nope', password: 'bad' });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/unknown user/i);
  });

  test('delete / logout test', async () => {
    const logoutRes = await request(app)
      .delete('/api/auth')
      .set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toHaveProperty('message', 'logout successful');
  });
});
