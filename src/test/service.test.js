const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../config.js');
const app = require('../service.js');
const endpointHelper = require('../endpointHelper.js');
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
  test("error code constructor works", () => {
    const err_message = "test error message";
    const err_status = 418;
    const statusErr = new endpointHelper.StatusCodeError(err_message, err_status);
    expect(statusErr.message).toBe(err_message);
    expect(statusErr.statusCode).toBe(err_status);
  });

  test('asyncHandler doesnt propagate accepted promise to next', async () => {
    const fn = async () => Promise.resolve(1);
    const wrapped = endpointHelper.asyncHandler(fn);
    const next = jest.fn();
    await wrapped({}, {}, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('asyncHandler propagates rejected promise to next', async () => {
    const err = new Error('fail async');
    const fn = async () => Promise.reject(err);
    const wrapped = endpointHelper.asyncHandler(fn);
    const next = jest.fn();
    await wrapped({}, {}, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('service.js tests', () => {
  test('get / returns welcome message and version', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'welcome to JWT Pizza');
    expect(res.body).toHaveProperty('version');
  });

  test('get/unknownendpoint returns unknown enpoint', async () => {
    const res = await request(app).get('/unknownendpoint');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message', 'unknown endpoint');
  });
});

describe('authRouter.js tests', () => {
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

  //I feel like this app should do this:
  /*test('addUser cant add users with the same email', async () => {
    const newUser = { name: 'test user', email: 'testuser@test.test', password: 'password', roles: [{ role: Role.Diner }] };
    const newUser2 = { name: 'test user', email: 'testuser@test.test', password: 'password', roles: [{ role: Role.Diner }] };
    const addedUser = await db.addUser(newUser);
    const addedUser2 = await db.addUser(newUser2);
    expect(addedUser2).toBeNull();
  });*/

  test('put / login valid user works', async () => {
    const newUser = { name: 'test user', email: 'testuser@test.test', password: 'password', roles: [{ role: Role.Diner }] };
    const expectedUser = { ...newUser };
    delete expectedUser.password;
    const res = await request(app).put('/api/auth').send({ email: newUser.email, password: 'password' });
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
    expect(res.body.user).toMatchObject(expectedUser);
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

describe('franchiseRouter.js tests', () => {

  beforeEach(() => {
      jest.resetModules();
      jest.clearAllMocks();
    });

  test('get / gets franchise returns a franchise', async () => {
    const adminUser = await createAdminUser();
    const token = jwt.sign({ id: adminUser.id, roles: [{ role: Role.Admin }] }, config.jwtSecret);
    
    const res = await request(app)
      .get('/api/franchise')
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1, limit: 10, name: 'test franchise' });
      
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('franchises');
    expect(Array.isArray(res.body.franchises)).toBe(true);
  });
  
  test('GET /api/franchise calls DB.getFranchises and returns result', async () => {
    const Role = { Admin: 'admin', Diner: 'diner', Franchisee: 'franchisee' };
    const DB = {
      getFranchises: jest.fn().mockResolvedValue([[{ id: 1, name: 'f1' }], true]),
    };
  
    jest.doMock('../database/database.js', () => ({ Role, DB }));
    const app = require('../service.js');
  
    const res = await request(app).get('/api/franchise?page=1&limit=5&name=abc');
    expect(res.status).toBe(200);
    expect(res.body.franchises).toBeDefined();
    expect(DB.getFranchises).toHaveBeenCalledWith(undefined, '1', '5', 'abc');
  });
  
  test('GET /api/franchise/:userId returns user franchises when requester is same user', async () => {
    const Role = { Admin: 'admin', Diner: 'diner' };
    const DB = {
      isLoggedIn: jest.fn().mockResolvedValue(true),
      getUserFranchises: jest.fn().mockResolvedValue([{ id: 2, name: 'mine' }]),
    };
    const payload = { id: 5, roles: [{ role: Role.Diner }] };
  
    jest.doMock('../database/database.js', () => ({ Role, DB }));
  
    const app = require('../service.js');
    const token = jwt.sign(payload, config.jwtSecret);
  
    const res = await request(app).get('/api/franchise/5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject([{ id: 2, name: 'mine' }]);
  });
  
  test('GET /api/franchise/:userId returns [] when requester unauthorized', async () => {
    const Role = { Admin: 'admin', Diner: 'diner' };
    const DB = {
      isLoggedIn: jest.fn().mockResolvedValue(true),
      getUserFranchises: jest.fn().mockResolvedValue([{ id: 3, name: 'other' }]),
    };
    const payload = { id: 6, roles: [{ role: Role.Diner }] };
  
    jest.doMock('../database/database.js', () => ({ Role, DB }));
    const app = require('../service.js');
    const token = jwt.sign(payload, config.jwtSecret);
  
    const res = await request(app).get('/api/franchise/5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(DB.getUserFranchises).not.toHaveBeenCalled();
  });
  
  test('POST /api/franchise allowed for Admin and returns created franchise', async () => {
    const Role = { Admin: 'admin' };
    const adminPayload = { id: 1, roles: [{ role: Role.Admin }] };
    const franchiseReq = { name: 'newF', admins: [{ email: 'a@x' }] };
    const DB = {
      isLoggedIn: jest.fn().mockResolvedValue(true),
      createFranchise: jest.fn().mockResolvedValue({ ...franchiseReq, id: 7, admins: [{ email: 'a@x', id: 4, name: 'n' }] }),     };
  
      jest.doMock('../database/database.js', () => ({ Role, DB }));
      const app = require('../service.js');
      const token = jwt.sign(adminPayload, config.jwtSecret);
  
      const res = await request(app).post('/api/franchise').set('Authorization', `Bearer ${token}`).send(franchiseReq);
      expect(res.status).toBe(200);
    expect(res.body.id).toBe(7);
    expect(DB.createFranchise).toHaveBeenCalledWith(franchiseReq);
  });

  test('POST /api/franchise forbidden for non-Admin', async () => {
    const Role = { Admin: 'admin', Diner: 'diner' };
    const userPayload = { id: 2, roles: [{ role: Role.Diner }] };
    const DB = { isLoggedIn: jest.fn().mockResolvedValue(true) };

    jest.doMock('../database/database.js', () => ({ Role, DB }));
    const app = require('../service.js');
    const token = jwt.sign(userPayload, config.jwtSecret);

    const res = await request(app).post('/api/franchise').set('Authorization', `Bearer ${token}`).send({ name: 'x' });
    expect(res.status).toBe(403);
  });

  test('POST /api/franchise propagates DB create errors (404)', async () => {
    const Role = { Admin: 'admin' };
    const adminPayload = { id: 1, roles: [{ role: Role.Admin }] };
    const err = new Error('unknown user for franchise admin a@x provided');
    err.statusCode = 404;
    const DB = {
      isLoggedIn: jest.fn().mockResolvedValue(true),
      createFranchise: jest.fn().mockRejectedValue(err),
    };

    jest.doMock('../database/database.js', () => ({ Role, DB }));
    const app = require('../service.js');
    const token = jwt.sign(adminPayload, config.jwtSecret);

    const res = await request(app).post('/api/franchise').set('Authorization', `Bearer ${token}`).send({ name: 'x', admins: [{ email: 'a@x' }] });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/unknown user/i);
  });
  
  test('DELETE /api/franchise/:franchiseId calls DB.deleteFranchise and returns message', async () => {
    const Role = { Admin: 'admin' };
    const DB = { deleteFranchise: jest.fn().mockResolvedValue() };
    jest.doMock('../database/database.js', () => ({ Role, DB }));
    const app = require('../service.js');
  
    const res = await request(app).delete('/api/franchise/123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'franchise deleted' });
    expect(DB.deleteFranchise).toHaveBeenCalledWith(123);
  });
  
  test('POST /api/franchise/:id/store allows franchise admin to create store', async () => {
    const Role = { Admin: 'admin', Diner: 'diner' };
    const payload = { id: 10, roles: [{ role: Role.Diner }] };
    const DB = {
      isLoggedIn: jest.fn().mockResolvedValue(true),
      getFranchise: jest.fn().mockResolvedValue({ id: 1, admins: [{ id: 10 }] }),
      createStore: jest.fn().mockResolvedValue({ id: 100, franchiseId: 1, name: 'SLC' }),
    };
  
    jest.doMock('../database/database.js', () => ({ Role, DB }));
    const app = require('../service.js');
    const token = jwt.sign(payload, config.jwtSecret);
  
    const res = await request(app).post('/api/franchise/1/store').set('Authorization', `Bearer ${token}`).send({ name: 'SLC' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 100, franchiseId: 1, name: 'SLC' });
    expect(DB.createStore).toHaveBeenCalledWith(1, { name: 'SLC' });
  });
  
  test('POST /api/franchise/:id/store forbidden when not admin nor franchise admin', async () => {
    const Role = { Admin: 'admin', Diner: 'diner' };
    const payload = { id: 11, roles: [{ role: Role.Diner }] };
    const DB = {
      isLoggedIn: jest.fn().mockResolvedValue(true),
      getFranchise: jest.fn().mockResolvedValue({ id: 1, admins: [{ id: 9 }] }),
    };
  
    jest.doMock('../database/database.js', () => ({ Role, DB }));
    const app = require('../service.js');
    const token = jwt.sign(payload, config.jwtSecret);
  
    const res = await request(app).post('/api/franchise/1/store').set('Authorization', `Bearer ${token}`).send({ name: 'SLC' });
    expect(res.status).toBe(403);
  });
  
  test('DELETE /api/franchise/:franchiseId/store/:storeId allows franchise admin', async () => {
    const Role = { Admin: 'admin', Diner: 'diner' };
    const payload = { id: 20, roles: [{ role: Role.Diner }] };
    const DB = {
      isLoggedIn: jest.fn().mockResolvedValue(true),
      getFranchise: jest.fn().mockResolvedValue({ id: 2, admins: [{ id: 20 }] }),
      deleteStore: jest.fn().mockResolvedValue(),
    };
  
    jest.doMock('../database/database.js', () => ({ Role, DB }));
    const app = require('../service.js');
    const token = jwt.sign(payload, config.jwtSecret);

    const res = await request(app).delete('/api/franchise/2/store/5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'store deleted' });
    expect(DB.deleteStore).toHaveBeenCalledWith(2, 5);
  });
});

describe('orderRouter.js tests', () => {
  test('GET /api/order/menu returns menu items', async () => {
    const res = await request(app).get('/api/order/menu');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('PUT /api/order/menu allows admin to add menu item', async () => {
    const adminUser = await createAdminUser();
    const adminAuthRes = await request(app).put('/api/auth').send({ email: adminUser.email, password: 'toomanysecrets' });
    const token = adminAuthRes.body.token;
    
    const menuItem = { title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 };

    const res = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${token}`).send(menuItem);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('PUT /api/order/menu forbidden for non-admin user', async () => {
    const dinerEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'test diner',
      email: dinerEmail,
      password: 'testpass',
    });
    const token = registerRes.body.token;

    const res = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${token}`).send({ title: 'test' });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('message', 'unable to add menu item');
  });

  test('PUT /api/order/menu requires authentication', async () => {
    const res = await request(app).put('/api/order/menu').send({ title: 'test' });
    expect(res.status).toBe(401);
  });

  test('GET /api/order returns user orders with pagination', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'order test user',
      email: userEmail,
      password: 'testpass',
    });
    const token = registerRes.body.token;

    const res = await request(app).get('/api/order?page=1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dinerId');
    expect(res.body).toHaveProperty('orders');
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  test('GET /api/order returns orders for authenticated user', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'order test user 2',
      email: userEmail,
      password: 'testpass',
    });
    const token = registerRes.body.token;

    const res = await request(app).get('/api/order').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  test('GET /api/order requires authentication', async () => {
    const res = await request(app).get('/api/order');
    expect(res.status).toBe(401);
  });

  test('POST /api/order creates order and calls factory', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ reportUrl: 'http://factory.test/report/123', jwt: 'factory-jwt-token' }),
    });

    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'order creator',
      email: userEmail,
      password: 'testpass',
    });
    const token = registerRes.body.token;

    const orderReq = { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }] };

    const res = await request(app).post('/api/order').set('Authorization', `Bearer ${token}`).send(orderReq);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('order');
    expect(res.body).toHaveProperty('followLinkToEndChaos');
    expect(res.body).toHaveProperty('jwt');
  });

  test('POST /api/order requires authentication', async () => {
    const res = await request(app).post('/api/order').send({ franchiseId: 1, storeId: 1, items: [] });
    expect(res.status).toBe(401);
  });

  test('POST /api/order with empty items array', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ reportUrl: 'http://factory.test/report/789', jwt: 'token' }),
    });

    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'order empty test',
      email: userEmail,
      password: 'testpass',
    });
    const token = registerRes.body.token;

    const orderReq = { franchiseId: 1, storeId: 1, items: [] };

    const res = await request(app).post('/api/order').set('Authorization', `Bearer ${token}`).send(orderReq);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('order');
  });
});

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

describe('database.js tests', () => { //666 the database is evil lol
  test('getMenu returns all menu items', async () => {
    const menu = await DB.getMenu();
    expect(Array.isArray(menu)).toBe(true);
    if (menu.length > 0) {
      expect(menu[0]).toHaveProperty('id');
      expect(menu[0]).toHaveProperty('title');
      expect(menu[0]).toHaveProperty('price');
    }
  });

  test('addMenuItem adds item to menu and returns with id', async () => {
    const newItem = {
      title: `Test Item ${Math.random()}`,
      description: 'Test description',
      image: 'test.png',
      price: 9.99,
    };
    const result = await DB.addMenuItem(newItem);
    expect(result).toHaveProperty('id');
    expect(result.title).toBe(newItem.title);
    expect(result.price).toBe(newItem.price);

    // Verify it was added
    const menu = await DB.getMenu();
    expect(menu.some((m) => m.id === result.id)).toBe(true);
  });

  test('addMenuItem with zero price', async () => {
    const newItem = {
      title: `Zero Price Item ${Math.random()}`,
      description: 'Free item',
      image: 'free.png',
      price: 0,
    };
    const result = await DB.addMenuItem(newItem);
    expect(result.price).toBe(0);
  });

  test('addMenuItem with large price', async () => {
    const newItem = {
      title: `Expensive Item ${Math.random()}`,
      description: 'Very expensive',
      image: 'expensive.png',
      price: 99.99,
    };
    const result = await DB.addMenuItem(newItem);
    expect(result.price).toBe(99.99);
  });

  test('loginUser registers token in database', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'login test user',
      email: userEmail,
      password: 'testpass',
    });
    const token = registerRes.body.token;
    const userId = registerRes.body.user.id;

    const isLoggedIn = await DB.isLoggedIn(token);
    expect(isLoggedIn).toBe(true);
  });

  test('isLoggedIn returns false for invalid token', async () => {
    const fakeToken = 'fake.token.signature';
    const isLoggedIn = await DB.isLoggedIn(fakeToken);
    expect(isLoggedIn).toBe(false);
  });

  test('logoutUser removes token from database', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'logout test user',
      email: userEmail,
      password: 'testpass',
    });
    const token = registerRes.body.token;

    // Verify logged in
    let isLoggedIn = await DB.isLoggedIn(token);
    expect(isLoggedIn).toBe(true);

    // Logout
    await DB.logoutUser(token);

    // Verify logged out
    isLoggedIn = await DB.isLoggedIn(token);
    expect(isLoggedIn).toBe(false);
  });

  test('getOrders returns empty array for user with no orders', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'no orders user',
      email: userEmail,
      password: 'testpass',
    });
    const user = registerRes.body.user;

    const ordersData = await DB.getOrders(user);
    expect(ordersData.dinerId).toBe(user.id);
    expect(Array.isArray(ordersData.orders)).toBe(true);
    expect(ordersData.orders.length).toBe(0);
  });

  test('addDinerOrder creates order with items', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'order user',
      email: userEmail,
      password: 'testpass',
    });
    const user = registerRes.body.user;

    const orderReq = {
      franchiseId: 1,
      storeId: 1,
      items: [
        { menuId: 1, description: 'Test Item', price: 5.99 },
        { menuId: 1, description: 'Another Item', price: 3.50 },
      ],
    };

    const order = await DB.addDinerOrder(user, orderReq);
    expect(order).toHaveProperty('id');
    expect(order.franchiseId).toBe(1);
    expect(order.storeId).toBe(1);
    expect(order.items.length).toBe(2);

    // Verify order was saved
    const ordersData = await DB.getOrders(user);
    expect(ordersData.orders.length).toBeGreaterThan(0);
  });

  test('addDinerOrder with empty items array', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'empty order user',
      email: userEmail,
      password: 'testpass',
    });
    const user = registerRes.body.user;

    const orderReq = {
      franchiseId: 1,
      storeId: 1,
      items: [],
    };

    const order = await DB.addDinerOrder(user, orderReq);
    expect(order).toHaveProperty('id');
    expect(order.items.length).toBe(0);
  });

  test('getOrders with pagination', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'pagination user',
      email: userEmail,
      password: 'testpass',
    });
    const user = registerRes.body.user;

    // Create multiple orders
    for (let i = 0; i < 3; i++) {
      await DB.addDinerOrder(user, {
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: 'Item', price: 5.99 }],
      });
    }

    // Get page 1
    const ordersPage1 = await DB.getOrders(user, 1);
    expect(ordersPage1.page).toBe(1);

    // Get page 2 (if exists)
    const ordersPage2 = await DB.getOrders(user, 2);
    expect(ordersPage2.page).toBe(2);
  });

  test('createFranchise with valid admin email', async () => {
    const adminUser = await createAdminUser();
    const franchiseName = `Test Franchise ${Math.random()}`;

    const franchise = await DB.createFranchise({
      name: franchiseName,
      admins: [{ email: adminUser.email }],
    });

    expect(franchise).toHaveProperty('id');
    expect(franchise.name).toBe(franchiseName);
    expect(franchise.admins.length).toBe(1);
    expect(franchise.admins[0].email).toBe(adminUser.email);
  });

  test('createFranchise with invalid admin email throws error', async () => {
    const franchiseName = `Bad Franchise ${Math.random()}`;

    await expect(
      DB.createFranchise({
        name: franchiseName,
        admins: [{ email: 'nonexistent@email.com' }],
      })
    ).rejects.toThrow('unknown user for franchise admin nonexistent@email.com provided');
  });

  test('createFranchise with multiple admins', async () => {
    const admin1 = await createAdminUser();
    const admin2 = await createAdminUser();
    const franchiseName = `Multi Admin Franchise ${Math.random()}`;

    const franchise = await DB.createFranchise({
      name: franchiseName,
      admins: [{ email: admin1.email }, { email: admin2.email }],
    });

    expect(franchise.admins.length).toBe(2);
  });

  test('deleteFranchise removes franchise and related data', async () => {
    const adminUser = await createAdminUser();
    const franchiseName = `Delete Test Franchise ${Math.random()}`;

    const franchise = await DB.createFranchise({
      name: franchiseName,
      admins: [{ email: adminUser.email }],
    });

    const franchiseId = franchise.id;

    // Delete franchise
    await DB.deleteFranchise(franchiseId);

    // Verify it's deleted by trying to get it
    const adminToken = (await request(app).put('/api/auth').send({ email: adminUser.email, password: 'toomanysecrets' })).body.token;
    const res = await request(app).get(`/api/franchise/${franchiseId}`).set('Authorization', `Bearer ${adminToken}`);
    // Should return empty or not found
    expect(res.body).toEqual([]);
  });

  test('getFranchises returns franchises with pagination', async () => {
    const adminUser = await createAdminUser();
    const franchiseName = `Searchable Franchise ${Math.random()}`;

    const franchise = await DB.createFranchise({
      name: franchiseName,
      admins: [{ email: adminUser.email }],
    });

    const franchises = await DB.getFranchises(null, 0, 10, franchiseName);
    expect(Array.isArray(franchises[0])).toBe(true);
    expect(typeof franchises[1]).toBe('boolean');
  });

  test('getFranchises with wildcard filter', async () => {
    const franchises = await DB.getFranchises(null, 0, 10, '*');
    expect(Array.isArray(franchises[0])).toBe(true);
  });

  test('getFranchises with specific name filter', async () => {
    const adminUser = await createAdminUser();
    const uniqueName = `Unique Franchise ${Math.random().toString(36).substring(0, 8)}`;

    await DB.createFranchise({
      name: uniqueName,
      admins: [{ email: adminUser.email }],
    });

    const franchises = await DB.getFranchises(null, 0, 10, uniqueName);
    expect(franchises[0].some((f) => f.name === uniqueName)).toBe(true);
  });

  test('getUserFranchises returns empty array for regular user', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'regular user',
      email: userEmail,
      password: 'testpass',
    });
    const user = registerRes.body.user;

    const franchises = await DB.getUserFranchises(user.id);
    expect(Array.isArray(franchises)).toBe(true);
    expect(franchises.length).toBe(0);
  });

  test('createStore creates store for franchise', async () => {
    const adminUser = await createAdminUser();
    const franchiseName = `Store Test Franchise ${Math.random()}`;

    const franchise = await DB.createFranchise({
      name: franchiseName,
      admins: [{ email: adminUser.email }],
    });

    const store = await DB.createStore(franchise.id, { name: 'Test Store' });
    expect(store).toHaveProperty('id');
    expect(store.name).toBe('Test Store');
    expect(store.franchiseId).toBe(franchise.id);
  });

  test('deleteStore removes store from franchise', async () => {
    const adminUser = await createAdminUser();
    const franchise = await DB.createFranchise({
      name: `Delete Store Franchise ${Math.random()}`,
      admins: [{ email: adminUser.email }],
    });

    const store = await DB.createStore(franchise.id, { name: 'Store to Delete' });
    const storeId = store.id;

    // Delete store
    await DB.deleteStore(franchise.id, storeId);

    // Verify deletion by getting franchise
    const updatedFranchise = await DB.getFranchise(franchise);
    const deletedStore = updatedFranchise.stores.find((s) => s.id === storeId);
    expect(deletedStore).toBeUndefined();
  });

  test('getTokenSignature extracts last part of JWT', async () => {
    const token = 'header.payload.signature';
    const signature = DB.getTokenSignature(token);
    expect(signature).toBe('signature');
  });

  test('getTokenSignature handles invalid token', async () => {
    const token = 'invalid';
    const signature = DB.getTokenSignature(token);
    expect(signature).toBe('');
  });

  test('getOffset calculates correct offset for pagination', async () => {
    const offset1 = DB.getOffset(1, 10);
    expect(offset1).toBe(0);

    const offset2 = DB.getOffset(2, 10);
    expect(offset2).toBe(10);

    const offset5 = DB.getOffset(5, 20);
    expect(offset5).toBe(80);
  });

  test('updateUser updates name and returns user with token', async () => {
    const userEmail = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send({
      name: 'original name',
      email: userEmail,
      password: 'testpass',
    });
    const user = registerRes.body.user;

    const updatedUser = await DB.updateUser(user.id, 'updated name', userEmail, 'testpass');
    expect(updatedUser.name).toBe('updated name');
    expect(updatedUser).toHaveProperty('id');
  });

  test('getFranchise returns franchise with admins and stores', async () => {
    const adminUser = await createAdminUser();
    const franchise = await DB.createFranchise({
      name: `Get Franchise Test ${Math.random()}`,
      admins: [{ email: adminUser.email }],
    });

    await DB.createStore(franchise.id, { name: 'Store 1' });
    await DB.createStore(franchise.id, { name: 'Store 2' });

    const result = await DB.getFranchise(franchise);
    expect(result).toHaveProperty('admins');
    expect(result).toHaveProperty('stores');
    expect(Array.isArray(result.admins)).toBe(true);
    expect(Array.isArray(result.stores)).toBe(true);
  });

  test('addUser creates user with default diner role', async () => {
    const email = `diner${Math.random()}@test.com`;
    const user = await DB.addUser({
      name: 'new diner',
      email: email,
      password: 'testpass',
      roles: [{ role: Role.Diner }],
    });

    expect(user).toHaveProperty('id');
    expect(user.name).toBe('new diner');
    expect(user.email).toBe(email);
    expect(user.roles[0].role).toBe('diner');
    expect(user.password).toBeUndefined();
  });

  test('getUser retrieves user by email and password', async () => {
    const email = `getuser${Math.random()}@test.com`;
    await DB.addUser({
      name: 'get user test',
      email: email,
      password: 'testpass',
      roles: [{ role: Role.Diner }],
    });

    const user = await DB.getUser(email, 'testpass');
    expect(user.email).toBe(email);
    expect(user.name).toBe('get user test');
  });

  test('getUser throws error for invalid password', async () => {
    const email = `invalidpass${Math.random()}@test.com`;
    await DB.addUser({
      name: 'invalid pass test',
      email: email,
      password: 'correctpass',
      roles: [{ role: Role.Diner }],
    });

    await expect(DB.getUser(email, 'wrongpass')).rejects.toThrow('unknown user');
  });

  test('getUser throws error for nonexistent email', async () => {
    await expect(DB.getUser('nonexistent@test.com', 'anypass')).rejects.toThrow('unknown user');
  });
});
