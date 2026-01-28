# Project Function Summary

This file summarizes what every function in each JavaScript file in the `src/` tree does. Use this as a quick reference for testing, maintenance, and writing additional tests.

**src/endpointHelper.js**
- `class StatusCodeError extends Error(message, statusCode)`: Error subclass that stores `statusCode` (used by routers to return specific HTTP status codes).
- `asyncHandler(fn)`: Higher-order function that wraps an async Express handler so any rejected Promise is forwarded to `next()` (default error middleware).

**src/config.js**
- Exports configuration object (no functions): `jwtSecret`, `db` connection settings, `factory` URL and API key.

**src/index.js**
- Top-level runner (no exported functions): reads port from `process.argv` and starts the `app` from `service.js`.

**src/init.js**
- Script entry (no exported functions): reads CLI args and calls `DB.addUser` to create an admin user, exits with usage message if args missing.

**src/service.js**
- Builds and exports the Express `app` instance. Key inline functions/middlewares:
  - JSON body parser: `express.json()` middleware applied to `app`.
  - `setAuthUser` middleware (imported): populates `req.user` where applicable.
  - CORS header middleware (anonymous): sets `Access-Control-*` headers on responses.
  - `/api/docs` handler (anonymous): responds with API docs aggregated from routers and config info.
  - `GET /` handler (anonymous): returns welcome message and version.
  - `*` 404 handler (anonymous): returns `{ message: 'unknown endpoint' }`.
  - Error handler (anonymous): default Express error handler sending `{ message, stack }` and status `err.statusCode ?? 500`.

**src/routes/authRouter.js**
- `async function setAuthUser(req, res, next)`: reads Bearer token; if present and `DB.isLoggedIn(token)` is true, verifies JWT and sets `req.user` with helper `req.user.isRole(role)`; clears `req.user` on verification errors; always calls `next()`.
- `authRouter.authenticateToken(req, res, next)`: middleware that returns 401 when `req.user` is falsy; otherwise calls `next()`.
- `authRouter.post('/', ...)` (register handler): validates `name,email,password` from `req.body`, calls `DB.addUser(...)` and `setAuth(user)` then responds with `{ user, token }`.
- `authRouter.put('/', ...)` (login handler): uses `DB.getUser(email,password)`, signs a token via `setAuth`, responds with `{ user, token }`.
- `authRouter.delete('/', ...)` (logout handler): protected route; calls `clearAuth(req)` to remove token from DB and responds `{ message: 'logout successful' }`.
- `async function setAuth(user)`: signs JWT with `config.jwtSecret`, calls `DB.loginUser(user.id, token)` and returns the token.
- `async function clearAuth(req)`: extracts token and calls `DB.logoutUser(token)` if token present.
- `function readAuthToken(req)`: helper that reads `Authorization` header and returns token (the part after `Bearer `) or `null`.

**src/routes/userRouter.js**
- `GET /me` handler: protected route (uses `authRouter.authenticateToken`) that returns `req.user`.
- `PUT /:userId` handler: protected route; checks permission (`user.id === userId` or `user.isRole(Role.Admin)`), calls `DB.updateUser(userId, ...)`, signs a new token via `setAuth(updatedUser)`, returns `{ user: updatedUser, token }`.
- `DELETE /:userId` handler: protected route stub returning `{ message: 'not implemented' }`.
- `GET /` handler: protected route stub returning `{ message: 'not implemented', users: [], more: false }`.

**src/routes/orderRouter.js**
- `GET /menu` handler: returns `DB.getMenu()` result.
- `PUT /menu` handler: protected; requires `Role.Admin` (via `req.user.isRole`), calls `DB.addMenuItem(...)` then returns `DB.getMenu()`; throws `StatusCodeError('unable to add menu item', 403)` if not admin.
- `GET /` handler: protected; returns `DB.getOrders(req.user, req.query.page)`.
- `POST /` handler: protected; calls `DB.addDinerOrder(req.user, orderReq)`, forwards the order to the external factory with `fetch(config.factory.url)/api/order` and responds with either factory success (`{ order, followLinkToEndChaos: reportUrl, jwt }`) or factory failure (HTTP 500 and message).

**src/routes/franchiseRouter.js**
- `GET /` handler: calls `DB.getFranchises(req.user, page, limit, name)` and returns `{ franchises, more }`; when the requester is admin, it populates franchise details via `getFranchise`, otherwise it includes stores only.
- `GET /:userId` handler: protected; returns `DB.getUserFranchises(userId)` only when requester is the same user or has `Role.Admin`; otherwise returns `[]`.
- `POST /` handler: protected; requires `Role.Admin` and calls `DB.createFranchise(franchise)`; throws `StatusCodeError('unable to create a franchise', 403)` when unauthorized.
- `DELETE /:franchiseId` handler: calls `DB.deleteFranchise(franchiseId)` and returns `{ message: 'franchise deleted' }`.
- `POST /:franchiseId/store` handler: protected; calls `DB.getFranchise({ id })`, checks permissions (Admin or franchise admin), calls `DB.createStore(franchise.id, req.body)`, returns created store; throws `StatusCodeError('unable to create a store', 403)` when unauthorized.
- `DELETE /:franchiseId/store/:storeId` handler: protected; similar permission checks then `DB.deleteStore(franchiseId, storeId)` and returns `{ message: 'store deleted' }`.

**src/database/database.js**
Class `DB` (instance exported as `DB`):
- `constructor()`: initializes `this.initialized = this.initializeDatabase()` (ensures DB setup runs asynchronously on module load).
- `async getMenu()`: gets connection via `getConnection()`, runs `SELECT * FROM menu`, returns rows; closes connection.
- `async addMenuItem(item)`: inserts into `menu` and returns `{ ...item, id: insertId }`.
- `async addUser(user)`: hashes `user.password` with bcrypt, inserts into `user` table, inserts `userRole` rows for each role (special handling for `Role.Franchisee` to lookup franchise id), returns user object with `id` and password omitted.
- `async getUser(email, password)`: fetches user row by email, verifies password via bcrypt.compare (when password provided), throws `StatusCodeError('unknown user', 404)` on missing/invalid, loads roles from `userRole` and returns user object with roles and no password.
- `async updateUser(userId, name, email, password)`: builds `UPDATE user SET ...` dynamically (hashing the new password if provided), executes update, returns `getUser(email, password)`.
- `async loginUser(userId, token)`: stores the token signature (via `getTokenSignature`) into `auth` table with `INSERT ... ON DUPLICATE KEY UPDATE`.
- `async isLoggedIn(token)`: checks `auth` table for token signature and returns boolean.
- `async logoutUser(token)`: deletes auth row by signature.
- `async getOrders(user, page = 1)`: computes offset via `getOffset`, queries `dinerOrder` page, for each order loads `orderItem` rows and attaches them as `items`, returns `{ dinerId, orders, page }`.
- `async addDinerOrder(user, order)`: inserts into `dinerOrder` and `orderItem` rows after resolving each item's `menuId` via `getID`, returns order with assigned `id`.
- `async createFranchise(franchise)`: verifies each admin email exists (throws `StatusCodeError` 404 if not), inserts into `franchise`, inserts `userRole` franchisee rows for admins, returns franchise with `id`.
- `async deleteFranchise(franchiseId)`: uses transaction to delete `store`, `userRole` entries for objectId, and `franchise`; rolls back and throws `StatusCodeError('unable to delete franchise', 500)` on error.
- `async getFranchises(authUser, page = 0, limit = 10, nameFilter = '*')`: retrieves franchises with pagination and wildcard name matching; when `authUser.isRole(Role.Admin)` calls `getFranchise` to populate details, otherwise adds stores only; returns `[franchises, more]`.
- `async getUserFranchises(userId)`: finds franchise IDs from `userRole` then loads franchise rows and calls `getFranchise` for each; returns array.
- `async getFranchise(franchise)`: populates `franchise.admins` and `franchise.stores` (stores include `totalRevenue` aggregated) and returns the augmented franchise.
- `async createStore(franchiseId, store)`: inserts into `store` and returns `{ id, franchiseId, name }`.
- `async deleteStore(franchiseId, storeId)`: deletes the store row.
- `getOffset(currentPage = 1, listPerPage)`: returns `(currentPage - 1) * [listPerPage]` (implementation note: uses array literal with coercion in original code).
- `getTokenSignature(token)`: returns JWT signature segment (third 'dot' part) or empty string when missing.
- `async query(connection, sql, params)`: helper that calls `connection.execute(sql, params)` and returns `results` (first element).
- `async getID(connection, key, value, table)`: executes `SELECT id FROM ${table} WHERE ${key}=?` and returns `id` if found; throws `Error('No ID found')` otherwise.
- `async getConnection()`: awaits `this.initialized` then returns `_getConnection()`.
- `async _getConnection(setUse = true)`: creates a connection via `mysql2/promise.createConnection(...)`, runs `USE <database>` when `setUse` true, returns the connection.
- `async initializeDatabase()`: creates database if missing, executes table creation statements from `dbModel`, and inserts a default admin user if database was created.
- `async checkDatabaseExists(connection)`: queries `INFORMATION_SCHEMA.SCHEMATA` to detect whether the configured DB exists.

**src/database/dbModel.js**
- Exports `tableCreateStatements` array of DDL SQL strings used by `initializeDatabase` (no functions).

**src/model/model.js**
- Exports constant `Role` with string role names: `{ Diner, Franchisee, Admin }` (no functions).

---

If you want, I can also:
- produce a per-function test checklist (unit vs integration) mapped to current test coverage, or
- generate a small call graph showing which router handlers call which `DB` methods.

File saved at: `aigenprogsummary.md` in the repo root.
