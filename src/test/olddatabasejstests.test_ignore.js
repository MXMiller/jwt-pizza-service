
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

    await expect(db.addMenuItem(null)).rejects.toThrow();

    const nullItem = {title: null, description: null, image: null, price: null};
    await expect(db.addMenuItem(nullItem)).rejects.toThrow();
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

  test('addUser add diner user', async () => {
    const newUser = { name: 'test diner user', email: 'testdineruser@test.test', password: 'password', roles: [{ role: Role.Diner }] };
    const addedUser = await db.addUser(newUser);
    expect(addedUser.name).toBe(newUser.name);
    expect(addedUser.email).toBe(newUser.email);
    expect(addedUser.roles[0].role).toBe(newUser.roles[0].role);
    expect(addedUser).toHaveProperty('id');
  });

  //I feel like this app should do this:
  test('addUser cant add users with the same email', async () => {
    const newUser = { name: 'test user', email: 'testuser@test.test', password: 'password', roles: [{ role: Role.Diner }] };
    const newUser2 = { name: 'test user', email: 'testuser@test.test', password: 'password', roles: [{ role: Role.Diner }] };
    const addedUser = await db.addUser(newUser);
    const addedUser2 = await db.addUser(newUser2);
    expect(addedUser2).toBeNull();
  });

  test('getUser gets user', async () => {
    const newUser = { name: 'get test user', email: 'gettestuser@test.test', password: 'getpassword', roles: [{ role: Role.Diner }] };
    const addedUser = await db.addUser(newUser);
    const gotUser = await db.getUser(addedUser.email, addedUser.password);
    expect(gotUser.name).toBe(addedUser.name);
    expect(gotUser.email).toBe(addedUser.email);
    expect(gotUser.roles[0].role).toBe(addedUser.roles[0].role);
    expect(gotUser).toHaveProperty('id');
  });

  test('getUser throws error when email doesnt exist', async () => {
    await expect(db.getUser('dosntexist@test.test', 'password')).rejects.toThrow();  
  });

  test('getUser throws error with invalid password', async () => {
    const newUser = { name: 'wrong password user', email: 'wrongpassword@test.test', password: 'password', roles: [{ role: Role.Diner }] };
    const addedUser = await db.addUser(newUser);
    await expect(db.getUser(addedUser.email, 'wrongpassword')).rejects.toThrow();
  });

  //FIX THIS
  test('updateUser updates user info', async () => {
    const newUser = { name: 'test diner user', email: 'testdineruser@test.test', password: 'password', roles: [{ role: Role.Diner }] };
    const addedUser = await db.addUser(newUser);

    const updateUser = { name: 'updated user', email: 'updateduser@test.test', password: 'updatedpassword', roles: [{ role: Role.Diner }] };
    const updatedUser = await db.updateUser(addedUser.id, updateUser);
    
    expect(updatedUser.name).toBe(updateUser.name);
    expect(updatedUser.email).toBe(updateUser.email);
    expect(updatedUser.roles[0].role).toBe(updateUser.roles[0].role);
    expect(updatedUser.id).toBe(addedUser.id);

    expect(updatedUser.name).not.toBe(addedUser.name);
    expect(updatedUser.email).not.toBe(addedUser.email);
  });

  test('loginUser', async () => {
    
  });

  test('isLoggedIn', async () => {

  });

  test('logoutUser', async () => {

  });

  test('getOrders', async () => {
    
  });

  test('addDinerOrder', async () => {
    
  });

  test('createFranchise', async () => {
    
  });

  test('deleteFranchise', async () => {

  });

  test('getFranchises', async () => {
  });

  test('getUserFranchises', async () => {

  });

  test('getFranchise', async () => {
  });

  test('createStore', async () => {

  });

  test('deleteStore', async () => {
  });
});
