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