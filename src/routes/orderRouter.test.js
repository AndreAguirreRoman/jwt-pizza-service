const request = require('supertest');
const app = require('../service');
const { DB, Role } = require('../database/database');

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

async function createAdminAndLogin() {
  const password = 'secretpassword';
  const name = randomName();
  const email = `${name}@admin.com`;

  await DB.addUser({
    name,
    email,
    password,
    roles: [{ role: Role.Admin }],
  });

  const loginRes = await request(app).put('/api/auth').send({ email, password });
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toBeDefined();

  return { token: loginRes.body.token, email };
}

let dinerToken;
let dinerUser;

let adminToken;
let adminEmail;

let franchiseId;
let storeId;
let menuId;

beforeAll(async () => {
  // 1) Create diner via register (gets token)
  const diner = { name: 'pizza diner', email: `${randomName()}@test.com`, password: 'a' };
  const regRes = await request(app).post('/api/auth').send(diner);
  expect(regRes.status).toBe(200);
  dinerToken = regRes.body.token;
  expectValidJwt(dinerToken);
  dinerUser = regRes.body.user; // includes id/name/email/roles

  // 2) Create + login admin (don’t rely on a@jwt.com existing in CI)
  const admin = await createAdminAndLogin();
  adminToken = admin.token;
  adminEmail = admin.email;

  // 3) Create a menu item (admin)
  const menuRes = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'TestPizza', description: 't', image: 'x.png', price: 0.01 });

  expect(menuRes.status).toBe(200);
  const lastMenuItem = menuRes.body[menuRes.body.length - 1];
  menuId = lastMenuItem.id;
  expect(menuId).toBeDefined();

  // 4) Create franchise (admin) – admins must be existing users, so use adminEmail
  const franchiseRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `Fr-${Date.now()}`, admins: [{ email: adminEmail }] });

  expect(franchiseRes.status).toBe(200);
  franchiseId = franchiseRes.body.id;
  expect(franchiseId).toBeDefined();

  // 5) Create store
  const storeRes = await request(app)
    .post(`/api/franchise/${franchiseId}/store`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `S-${Date.now()}` });

  expect(storeRes.status).toBe(200);
  storeId = storeRes.body.id;
  expect(storeId).toBeDefined();
});

afterEach(() => {
  // keep mocks from leaking into other tests
  jest.restoreAllMocks();
});

test('POST /api/order (factory ok) returns order + reportUrl + jwt', async () => {
  // Mock the external factory call
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ jwt: 'fake-factory-jwt', reportUrl: 'http://example.com/report' }),
  });

  const orderPayload = {
    franchiseId,
    storeId,
    items: [{ menuId, description: 'TestPizza', price: 0.01 }],
  };

  const res = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${dinerToken}`)
    .send(orderPayload);

  expect(res.status).toBe(200);

  // response shape
  expect(res.body).toHaveProperty('order');
  expect(res.body).toHaveProperty('followLinkToEndChaos', 'http://example.com/report');
  expect(res.body).toHaveProperty('jwt', 'fake-factory-jwt');

  // returned order should include id and match key fields
  expect(res.body.order).toHaveProperty('id');
  expect(res.body.order).toMatchObject({
    franchiseId,
    storeId,
  });

  // Ensure we called the factory with expected payload
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const [url, options] = global.fetch.mock.calls[0];
  expect(typeof url).toBe('string');
  expect(options).toHaveProperty('method', 'POST');
  expect(options).toHaveProperty('headers');
  expect(options.headers).toHaveProperty('Content-Type', 'application/json');

  const sentBody = JSON.parse(options.body);
  expect(sentBody).toHaveProperty('order');
  expect(sentBody).toHaveProperty('diner');

  // diner object should reflect the authenticated user (req.user)
  expect(sentBody.diner).toMatchObject({
    id: dinerUser.id,
    name: dinerUser.name,
    email: dinerUser.email,
  });
});

test('POST /api/order (factory not ok) returns 500 + message', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ reportUrl: 'http://example.com/failure-report' }),
  });

  const orderPayload = {
    franchiseId,
    storeId,
    items: [{ menuId, description: 'TestPizza', price: 0.01 }],
  };

  const res = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${dinerToken}`)
    .send(orderPayload);

  expect(res.status).toBe(500);
  expect(res.body).toEqual({
    message: 'Failed to fulfill order at factory',
    followLinkToEndChaos: 'http://example.com/failure-report',
  });
});
