const request = require('supertest');
const app = require('../service.js');

describe('userRouter.js tests', () => {
  test('GET /api/user/me returns authenticated user', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'test user me',
      email: userEmail,
      password: 'testpass',
    });
    const token = registerRes.body.token;
    const userId = registerRes.body.user.id;

    const res = await request(app).get('/api/user/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', userId);
    expect(res.body).toHaveProperty('name', 'test user me');
    expect(res.body).toHaveProperty('email', userEmail);
    expect(res.body).toHaveProperty('roles');
  });

  test('GET /api/user/me requires authentication', async () => {
    const res = await request(app).get('/api/user/me');
    expect(res.status).toBe(401);
  });

  test('PUT /api/user/:userId allows user to update own profile', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'original name',
      email: userEmail,
      password: 'testpass',
    });
    const token = registerRes.body.token;
    const userId = registerRes.body.user.id;

    const updateRes = await request(app)
      .put(`/api/user/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'updated name', email: userEmail, password: 'testpass' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toHaveProperty('user');
    expect(updateRes.body.user.name).toBe('updated name');
    expect(updateRes.body).toHaveProperty('token');
  });

  test('PUT /api/user/:userId allows admin to update other users', async () => {
    const { Role, DB } = require('../database/database.js');
    
    async function createAdminUser() {
      let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
      user.name = Math.random().toString(36).substring(2, 12);
      user.email = user.name + '@admin.com';
      user = await DB.addUser(user);
      return { ...user, password: 'toomanysecrets' };
    }

    const adminUser = await createAdminUser();
    const adminAuthRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: 'toomanysecrets' });
    const adminToken = adminAuthRes.body.token;

    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'target user',
      email: userEmail,
      password: 'testpass',
    });
    const userId = registerRes.body.user.id;

    const updateRes = await request(app)
      .put(`/api/user/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'admin updated name', email: userEmail, password: 'newpass' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.user.name).toBe('admin updated name');
  });

  test('PUT /api/user/:userId forbidden when user updates other users without admin role', async () => {
    const userEmail1 = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes1 = await request(app).post('/api/auth').send({
      name: 'user1',
      email: userEmail1,
      password: 'testpass',
    });
    const token1 = registerRes1.body.token;

    const userEmail2 = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes2 = await request(app).post('/api/auth').send({
      name: 'user2',
      email: userEmail2,
      password: 'testpass',
    });
    const userId2 = registerRes2.body.user.id;

    const updateRes = await request(app)
      .put(`/api/user/${userId2}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'hacked name', email: userEmail2, password: 'newpass' });

    expect(updateRes.status).toBe(403);
    expect(updateRes.body).toHaveProperty('message', 'unauthorized');
  });

  test('PUT /api/user/:userId updates email successfully', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'email test user',
      email: userEmail,
      password: 'testpass',
    });
    const token = registerRes.body.token;
    const userId = registerRes.body.user.id;

    const newEmail = Math.random().toString(36).substring(2, 12) + '@updated.com';
    const updateRes = await request(app)
      .put(`/api/user/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'email test user', email: newEmail, password: 'testpass' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.user.email).toBe(newEmail);
  });

  test('PUT /api/user/:userId updates password successfully', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'password test user',
      email: userEmail,
      password: 'oldpass',
    });
    const token = registerRes.body.token;
    const userId = registerRes.body.user.id;

    const updateRes = await request(app)
      .put(`/api/user/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'password test user', email: userEmail, password: 'newpass' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toHaveProperty('token');

    // Verify new password works
    const loginRes = await request(app).put('/api/auth').send({ email: userEmail, password: 'newpass' });
    expect(loginRes.status).toBe(200);
  });

  test('PUT /api/user/:userId requires authentication', async () => {
    const res = await request(app)
      .put('/api/user/1')
      .send({ name: 'test', email: 'test@test.com', password: 'pass' });

    expect(res.status).toBe(401);
  });

  test('PUT /api/user/:userId with all fields provided', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'all fields update user',
      email: userEmail,
      password: 'testpass',
    });
    const token = registerRes.body.token;
    const userId = registerRes.body.user.id;

    const updateRes = await request(app)
      .put(`/api/user/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'new full name', email: userEmail, password: 'testpass' });

    expect(updateRes.status).toBe(200);
  });

  test('DELETE /api/user/:userId returns not implemented', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'delete test user',
      email: userEmail,
      password: 'testpass',
    });
    const token = registerRes.body.token;
    const userId = registerRes.body.user.id;

    const res = await request(app)
      .delete(`/api/user/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'not implemented');
  });

  test('DELETE /api/user/:userId requires authentication', async () => {
    const res = await request(app).delete('/api/user/1');
    expect(res.status).toBe(401);
  });

  test('GET /api/user returns not implemented', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'list user',
      email: userEmail,
      password: 'testpass',
    });
    const token = registerRes.body.token;

    const res = await request(app)
      .get('/api/user')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'not implemented');
    expect(res.body).toHaveProperty('users', []);
    expect(res.body).toHaveProperty('more', false);
  });

  test('GET /api/user requires authentication', async () => {
    const res = await request(app).get('/api/user');
    expect(res.status).toBe(401);
  });
});
