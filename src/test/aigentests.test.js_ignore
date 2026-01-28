// Comprehensive tests with DB and network mocked to avoid real connections
jest.mock('../database/database.js', () => {
  const Role = { Diner: 'diner', Franchisee: 'franchisee', Admin: 'admin' };
  const DB = {
    loginUser: jest.fn(),
    isLoggedIn: jest.fn(),
    logoutUser: jest.fn(),
    getMenu: jest.fn(),
    addMenuItem: jest.fn(),
    getOrders: jest.fn(),
    addDinerOrder: jest.fn(),
    createFranchise: jest.fn(),
    getFranchise: jest.fn(),
    createStore: jest.fn(),
    deleteStore: jest.fn(),
    getFranchises: jest.fn(),
    getUserFranchises: jest.fn(),
    getUser: jest.fn(),
    updateUser: jest.fn(),
    getOffset: jest.fn((currentPage = 1, listPerPage) => (currentPage - 1) * listPerPage),
    getTokenSignature: jest.fn((t) => {
      const parts = (t || '').split('.');
      return parts.length > 2 ? parts[2] : '';
    }),
  };
  return { Role, DB };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { asyncHandler, StatusCodeError } = require('../endpointHelper.js');
const { setAuthUser, setAuth } = require('../routes/authRouter.js');
const { Role, DB } = require('../database/database.js');
const app = require('../service.js');
const config = require('../config.js');

beforeEach(() => {
  jest.clearAllMocks();
  // default: no one logged in
  DB.isLoggedIn.mockResolvedValue(false);
});

describe('endpointHelper and error flows', () => {
  test('StatusCodeError preserves statusCode and message', () => {
    const e = new StatusCodeError('uh oh', 499);
    expect(e.message).toBe('uh oh');
    expect(e.statusCode).toBe(499);
  });

  test('asyncHandler propagates rejected promise to next', async () => {
    const err = new Error('fail async');
    const fn = async () => Promise.reject(err);
    const wrapped = asyncHandler(fn);
    const next = jest.fn();
    await wrapped({}, {}, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('auth utilities and routes', () => {
  test('setAuth signs token and calls DB.loginUser', async () => {
    DB.loginUser.mockResolvedValue();
    const user = { id: 11, name: 'x', email: 'x@x', roles: [{ role: Role.Diner }] };
    const token = await setAuth(user);
    expect(typeof token).toBe('string');
    expect(DB.loginUser).toHaveBeenCalledWith(user.id, token);
  });

  test('setAuthUser attaches req.user when token valid and DB.isLoggedIn true', async () => {
    const payload = { id: 22, name: 'n', email: 'e', roles: [{ role: Role.Diner }] };
    const token = jwt.sign(payload, config.jwtSecret);
    DB.isLoggedIn.mockResolvedValue(true);
    jest.spyOn(jwt, 'verify').mockImplementation(() => payload);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();
    await setAuthUser(req, {}, next);
    expect(req.user).toBeDefined();
    expect(req.user.isRole('diner')).toBeTruthy();
    next();
    jwt.verify.mockRestore();
  });

  test('logout route returns 401 when not authenticated', async () => {
    const res = await request(app).delete('/api/auth');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/unauthorized/i);
  });

  test('logout route calls DB.logoutUser when token present', async () => {
    const payload = { id: 7, name: 'n', email: 'e', roles: [{ role: Role.Diner }] };
    const token = jwt.sign(payload, config.jwtSecret);
    DB.isLoggedIn.mockResolvedValue(true);
    jest.spyOn(jwt, 'verify').mockImplementation(() => payload);
    DB.logoutUser.mockResolvedValue();

    const res = await request(app).delete('/api/auth').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('logout successful');
    expect(DB.logoutUser).toHaveBeenCalled();
    jwt.verify.mockRestore();
  });

  test('register returns 400 when missing fields', async () => {
    const res = await request(app).post('/api/auth').send({ name: 'only' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name, email, and password are required/i);
  });
});

describe('order and franchise routes with DB/network mocked', () => {
  test('GET /api/order/menu returns DB.getMenu result', async () => {
    const menu = [{ id: 1, title: 'Veggie' }];
    DB.getMenu.mockResolvedValue(menu);
    const res = await request(app).get('/api/order/menu');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(menu);
  });

  test('PUT /api/order/menu forbidden for non-admin users', async () => {
    const payload = { id: 3, roles: [{ role: Role.Diner }] };
    const token = jwt.sign(payload, config.jwtSecret);
    DB.isLoggedIn.mockResolvedValue(true);
    jest.spyOn(jwt, 'verify').mockImplementation(() => payload);

    const res = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${token}`).send({ title: 'X' });
    expect(res.status).toBe(403);
    jwt.verify.mockRestore();
  });

  test('POST /api/order success when factory ok', async () => {
    const user = { id: 9, name: 'd', email: 'd@x', roles: [{ role: Role.Diner }] };
    const token = jwt.sign(user, config.jwtSecret);
    DB.isLoggedIn.mockResolvedValue(true);
    jest.spyOn(jwt, 'verify').mockImplementation(() => user);
    const order = { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veg', price: 0.5 }] };
    DB.addDinerOrder.mockResolvedValue({ ...order, id: 55 });

    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ reportUrl: 'u', jwt: 't' }) });

    const res = await request(app).post('/api/order').set('Authorization', `Bearer ${token}`).send(order);
    expect(res.status).toBe(200);
    expect(res.body.order).toBeDefined();
    expect(res.body.jwt).toBe('t');

    global.fetch.mockRestore();
    jwt.verify.mockRestore();
  });

  test('POST /api/order reports factory failure (500)', async () => {
    const user = { id: 10, name: 'd', email: 'd@x', roles: [{ role: Role.Diner }] };
    const token = jwt.sign(user, config.jwtSecret);
    DB.isLoggedIn.mockResolvedValue(true);
    jest.spyOn(jwt, 'verify').mockImplementation(() => user);
    const order = { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veg', price: 0.5 }] };
    DB.addDinerOrder.mockResolvedValue({ ...order, id: 66 });

    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ reportUrl: 'u' }) });

    const res = await request(app).post('/api/order').set('Authorization', `Bearer ${token}`).send(order);
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Failed to fulfill order at factory/i);

    global.fetch.mockRestore();
    jwt.verify.mockRestore();
  });
});

describe('utility functions on mocked DB', () => {
  test('getOffset numeric behavior', () => {
    expect(DB.getOffset(1, 10)).toBe(0);
    expect(DB.getOffset(2, 10)).toBe(10);
    expect(DB.getOffset(0, 10)).toBe(-10);
  });

  test('getTokenSignature extracts signature or empty', () => {
    expect(DB.getTokenSignature('a.b.c')).toBe('c');
    expect(DB.getTokenSignature('a.b')).toBe('');
    expect(DB.getTokenSignature('')).toBe('');
  });
});

describe('franchiseRouter and DB interactions', () => {
  test('DELETE /api/franchise/:franchiseId calls DB.deleteFranchise', async () => {
    DB.deleteFranchise = jest.fn().mockResolvedValue();
    const res = await request(app).delete('/api/franchise/123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'franchise deleted' });
    expect(DB.deleteFranchise).toHaveBeenCalledWith(123);
  });

  test('GET /api/franchise/:userId returns franchises when requester is same user', async () => {
    const payload = { id: 5, roles: [{ role: Role.Diner }] };
    const token = jwt.sign(payload, config.jwtSecret);
    DB.isLoggedIn.mockResolvedValue(true);
    jest.spyOn(jwt, 'verify').mockImplementation(() => payload);
    DB.getUserFranchises.mockResolvedValue([{ id: 2, name: 'myf' }]);

    const res = await request(app).get('/api/franchise/5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject([{ id: 2, name: 'myf' }]);
    jwt.verify.mockRestore();
  });

  test('GET /api/franchise/:userId returns empty array when unauthorized', async () => {
    const payload = { id: 6, roles: [{ role: Role.Diner }] };
    const token = jwt.sign(payload, config.jwtSecret);
    DB.isLoggedIn.mockResolvedValue(true);
    jest.spyOn(jwt, 'verify').mockImplementation(() => payload);
    DB.getUserFranchises.mockResolvedValue([{ id: 2, name: 'other' }]);

    const res = await request(app).get('/api/franchise/5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    jwt.verify.mockRestore();
  });

  test('POST /api/franchise allowed for Admin and calls DB.createFranchise', async () => {
    const admin = { id: 1, roles: [{ role: Role.Admin }] };
    const token = jwt.sign(admin, config.jwtSecret);
    DB.isLoggedIn.mockResolvedValue(true);
    jest.spyOn(jwt, 'verify').mockImplementation(() => admin);

    const franchise = { name: 'newF', admins: [{ email: 'a@x' }] };
    DB.createFranchise.mockResolvedValue({ ...franchise, id: 7, admins: [{ email: 'a@x', id: 4, name: 'n' }] });

    const res = await request(app).post('/api/franchise').set('Authorization', `Bearer ${token}`).send(franchise);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(7);
    expect(DB.createFranchise).toHaveBeenCalledWith(franchise);
    jwt.verify.mockRestore();
  });

  test('POST /api/franchise forbidden for non-Admin', async () => {
    const user = { id: 2, roles: [{ role: Role.Diner }] };
    const token = jwt.sign(user, config.jwtSecret);
    DB.isLoggedIn.mockResolvedValue(true);
    jest.spyOn(jwt, 'verify').mockImplementation(() => user);

    const res = await request(app).post('/api/franchise').set('Authorization', `Bearer ${token}`).send({ name: 'x' });
    expect(res.status).toBe(403);
    jwt.verify.mockRestore();
  });

  test('POST /api/franchise/:franchiseId/store allows franchise admin to create store', async () => {
    const payload = { id: 10, roles: [{ role: Role.Diner }] };
    const token = jwt.sign(payload, config.jwtSecret);
    DB.isLoggedIn.mockResolvedValue(true);
    jest.spyOn(jwt, 'verify').mockImplementation(() => payload);

    DB.getFranchise.mockResolvedValue({ id: 1, admins: [{ id: 10 }] });
    DB.createStore.mockResolvedValue({ id: 100, franchiseId: 1, name: 'SLC' });

    const res = await request(app).post('/api/franchise/1/store').set('Authorization', `Bearer ${token}`).send({ name: 'SLC' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 100, franchiseId: 1, name: 'SLC' });
    jwt.verify.mockRestore();
  });

  test('POST /api/franchise/:franchiseId/store forbidden when not admin nor franchise admin', async () => {
    const payload = { id: 11, roles: [{ role: Role.Diner }] };
    const token = jwt.sign(payload, config.jwtSecret);
    DB.isLoggedIn.mockResolvedValue(true);
    jest.spyOn(jwt, 'verify').mockImplementation(() => payload);

    DB.getFranchise.mockResolvedValue({ id: 1, admins: [{ id: 9 }] });

    const res = await request(app).post('/api/franchise/1/store').set('Authorization', `Bearer ${token}`).send({ name: 'SLC' });
    expect(res.status).toBe(403);
    jwt.verify.mockRestore();
  });

  test('DELETE /api/franchise/:franchiseId/store/:storeId allows franchise admin', async () => {
    const payload = { id: 20, roles: [{ role: Role.Diner }] };
    const token = jwt.sign(payload, config.jwtSecret);
    DB.isLoggedIn.mockResolvedValue(true);
    jest.spyOn(jwt, 'verify').mockImplementation(() => payload);

    DB.getFranchise.mockResolvedValue({ id: 2, admins: [{ id: 20 }] });
    DB.deleteStore.mockResolvedValue();

    const res = await request(app).delete('/api/franchise/2/store/5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'store deleted' });
    jwt.verify.mockRestore();
  });

  test('GET /api/franchise forwards query params to DB.getFranchises', async () => {
    const admin = { id: 1, roles: [{ role: Role.Admin }] };
    const token = jwt.sign(admin, config.jwtSecret);
    DB.isLoggedIn.mockResolvedValue(true);
    jest.spyOn(jwt, 'verify').mockImplementation(() => admin);

    DB.getFranchises.mockResolvedValue([[{ id: 1, name: 'f' }], false]);

    const res = await request(app).get('/api/franchise?page=0&limit=10&name=abc').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.franchises).toBeDefined();
    expect(DB.getFranchises).toHaveBeenCalled();
    jwt.verify.mockRestore();
  });
});
