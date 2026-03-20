const express = require('express');
const app = express();
const { asyncHandler } = require('../endpointHelper.js');
const { DB, Role } = require('../database/database.js');
const { authRouter, setAuth } = require('./authRouter.js');
const metrics = require('../metrics.js');
const logger = require('../logger.js');

app.use(metrics.requestTracker);
app.use(logger.httpLogger);

const userRouter = express.Router();

userRouter.docs = [
  {
    method: 'GET',
    path: '/api/user/me',
    requiresAuth: true,
    description: 'Get authenticated user',
    example: `curl -X GET localhost:3000/api/user/me -H 'Authorization: Bearer tttttt'`,
    response: { id: 1, name: '常用名字', email: 'a@jwt.com', roles: [{ role: 'admin' }] },
  },
  {
    method: 'GET',
    path: '/api/user?page=1&limit=10&name=*',
    requiresAuth: true,
    description: 'Gets a list of users',
    example: `curl -X GET localhost:3000/api/user -H 'Authorization: Bearer tttttt'`,
    response: {
      users: [
        {
          id: 1,
          name: '常用名字',
          email: 'a@jwt.com',
          roles: [{ role: 'admin' }],
        },
      ],
    },
  },
  {
    method: 'PUT',
    path: '/api/user/:userId',
    requiresAuth: true,
    description: 'Update user',
    example: `curl -X PUT localhost:3000/api/user/1 -d '{"name":"常用名字", "email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt'`,
    response: { user: { id: 1, name: '常用名字', email: 'a@jwt.com', roles: [{ role: 'admin' }] }, token: 'tttttt' },
  },
  {
    method: 'DELETE',
    path: '/api/user/:userId',
    requiresAuth: true,
    description: 'Delete user',
    example: `curl -X DELETE localhost:3000/api/user/1 -d '{"name":"常用名字", "email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt'`,
    response: { message: 'user deleted' },
  },
];

// getUser
userRouter.get(
  '/me',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    let startTime = Date.now();
    
    res.json(req.user);

    let endTime = Date.now();
    metrics.calcReqLatency(startTime, endTime);
    logger.httpLogger(req, res, this.next);
  })
);

// listUsers
userRouter.get(
  '/',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    let startTime = Date.now();
    
    const [users, more] = await DB.getUsers(req.user, req.query.page, req.query.limit, req.query.name);
    res.json({ users, more });

    let endTime = Date.now();
    metrics.calcReqLatency(startTime, endTime);
    logger.httpLogger(req, res, this.next);
  })
);

// updateUser
userRouter.put(
  '/:userId',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    let startTime = Date.now();
    
    const { name, email, password } = req.body;
    const userId = Number(req.params.userId);
    const user = req.user;
    if (user.id !== userId && !user.isRole(Role.Admin)) {
      return res.status(403).json({ message: 'unauthorized' });
    }

    const updatedUser = await DB.updateUser(userId, name, email, password);
    const auth = await setAuth(updatedUser);
    res.json({ user: updatedUser, token: auth });

    let endTime = Date.now();
    metrics.calcReqLatency(startTime, endTime);
    logger.httpLogger(req, res, this.next);
  })
);

// deleteUser
userRouter.delete(  
  '/:userId',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    let startTime = Date.now();
    
    const userId = Number(req.params.userId);
    await DB.deleteUser(userId);
    res.json({ message: 'user deleted' });

    let endTime = Date.now();
    metrics.calcReqLatency(startTime, endTime);
    logger.httpLogger(req, res, this.next);
  })
);

module.exports = userRouter;
