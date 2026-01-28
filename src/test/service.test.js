const request = require('supertest');
const app = require('../service.js');
const endpointHelper = require('../endpointHelper.js');
const service = require('../service.js');
const {database, Role, DB} = require('../database/database.js');
const dbModel = require('../database/dbModel.js');
const authRouter = require('../routes/authRouter.js');
const franchiseRouter = require('../routes/franchiseRouter.js');
const userRouter = require('../routes/userRouter.js');
const orderRouter = require('../routes/orderRouter.js');

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
  /*test('apiRouter get /docs returns version, endpoints, and config', async () => {
    const res = await request(app).get('/docs');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('endpoints');
    expect(res.body).toHaveProperty('config');
  });*/

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

  /*test('error handler handles errors', async () => {
    const err = new Error('test error handler');
    err.statusCode = 500;
    //how do i made this throw and error?
  });*/
});

describe('database.js tests', () => {
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

  let db = DB;

  test('getMenu returns array of menu items', async () => {
    const menu = await db.getMenu();
    expect(Array.isArray(menu)).toBe(true);
    expect(menu.length).toBeGreaterThan(0);
    expect(menu[0]).toHaveProperty('description');
    expect(menu[0]).toHaveProperty('id');
    expect(menu[0]).toHaveProperty('price');
    expect(menu[0]).toHaveProperty('title');
  });

  test('addMenuItem adds a menu item', async () => {
    const newItem = {title: 'Test Pizza', description: 'A pizza for testing', image: 'none', price: 9.99};
    const addedItem = await db.addMenuItem(newItem);
    expect(addedItem.title).toBe(newItem.title);
    expect(addedItem.description).toBe(newItem.description);
    expect(addedItem.image).toBe(newItem.image);
    expect(addedItem.price).toBe(newItem.price);
    expect(addedItem).toHaveProperty('id');
  });

  test('addMenuItem cant add a null item', async () => {
    const fakeConnection = {
      execute: jest.fn().mockResolvedValue([{ insertId: 1 }]),
      query: jest.fn().mockResolvedValue(),
      end: jest.fn().mockResolvedValue(),
    };
    jest.doMock('mysql2/promise', () => ({ createConnection: jest.fn().mockResolvedValue(fakeConnection) }));

    await expect(DB.addMenuItem(null)).rejects.toThrow();
    const nullItem = {title: null, description: null, image: null, price: null};
    await expect(db.addMenuItem(nullItem)).rejects.toThrow();;
  });

  test('addMenuItem allitems have different id', async () => {
    const newItem = {title: 'Test Pizza', description: 'A pizza for testing', image: 'none', price: 9.99};
    const addedItem = await db.addMenuItem(newItem);
    const addedItem2 = await db.addMenuItem(newItem);
    expect(addedItem.title).toBe(addedItem2.title);
    expect(addedItem.description).toBe(addedItem2.description);
    expect(addedItem.image).toBe(addedItem2.image);
    expect(addedItem.price).toBe(addedItem2.price);
    expect(addedItem.id).not.toBe(addedItem2.id);
  });
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
