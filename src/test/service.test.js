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


