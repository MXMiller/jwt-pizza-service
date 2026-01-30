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

describe('database.js tests', () => { 
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
    expect(franchises[0].some((f) => f.id === franchise.id)).toBe(true);
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
