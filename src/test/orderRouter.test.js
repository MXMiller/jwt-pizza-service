const request = require('supertest');
const app = require('../service.js');
const { Role, DB } = require('../database/database.js');

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
