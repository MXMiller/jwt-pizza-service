const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../config.js');

describe('franchiseRouter routes and edge cases', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
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
      createFranchise: jest.fn().mockResolvedValue({ ...franchiseReq, id: 7, admins: [{ email: 'a@x', id: 4, name: 'n' }] }),
    };

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
