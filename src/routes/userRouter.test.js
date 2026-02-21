const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let token;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  token = registerRes.body.token;
  expect(token).toBeDefined();
});


test('GET /api/user/me returns user with token', async () => {
  const res = await request(app).get('/api/user/me').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);

  expect(res.body).toHaveProperty('email', testUser.email);
  expect(res.body).toHaveProperty('name', testUser.name);
});


test('UPDATE user authorized', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const userId = loginRes.body.user.id;

  const newName = `new-${Date.now()}`;
  const res = await request(app).put(`/api/user/${userId}`).set('Authorization', `Bearer ${token}`)
  .send({ name: newName, email: testUser.email });;
  expect(res.status).toBe(200);
});


test('UPDATE user unauthorized', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  const userId = loginRes.body.user.id;

  const newName = `new-${Date.now()}`;
  const res = await request(app).put(`/api/user/${userId+1}`).set('Authorization', `Bearer ${token}`)
  .send({ name: newName, email: testUser.email });;
  expect(res.status).toBe(403);
});

test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
  const [, userToken] = await registerUser(request(app));
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);
  expect(listUsersRes.status).toBe(200);
});

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

test('delete user unauthorized', async () => {
  const res = await request(app).delete('/api/user/1');
  expect(res.status).toBe(401);
});

test('delete user forbidden for non-admin', async () => {
  const [user, token] = await registerUser(request(app)); // diner
  const res = await request(app)
    .delete(`/api/user/${user.id}`)
    .set('Authorization', 'Bearer ' + token);
  expect(res.status).toBe(403);
});

test('admin can delete a user', async () => {
  const [victim] = await registerUser(request(app));

  const adminLogin = await request(app).put('/api/auth').send({ email: 'a@jwt.com', password: 'admin' });
  const adminToken = adminLogin.body.token;

  const del = await request(app)
    .delete(`/api/user/${victim.id}`)
    .set('Authorization', 'Bearer ' + adminToken);

  expect(del.status).toBe(200);
  console.log('Admin Token is:', adminToken);
});