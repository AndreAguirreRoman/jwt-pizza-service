const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');


const user = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}
let adminToken;
let adminId;
let token;

let franchiseeEmail;
let franchiseId;
let storeId;

beforeAll(async () => {

    user.email = Math.random().toString(36).substring(2,12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(user);
    token = registerRes.body.token;
    expect(token).toBeDefined();

    let admin = await createAdminUser();
    const adminLoginRes = await request(app).put('/api/auth').send({email: admin.email, password: admin.password});
    adminToken = adminLoginRes.body.token;
    adminId = admin.id;
    expect(adminToken).toBeDefined();

    const franchiseRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `fr-${Date.now()}`, admins: [{ email: admin.email }] });

    franchiseId = franchiseRes.body.id;
    expect(franchiseId).toBeDefined();

    const storeRes = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `store-${Date.now()}` });

    storeId = storeRes.body.id;
    expect(storeId).toBeDefined();

    franchiseeEmail = `f-${Date.now()}@test.com`;
    const franchisee = { name: 'pizza franchisee', email: franchiseeEmail, password: 'a' };
    const regRes = await request(app).post('/api/auth').send(franchisee);
    expect(regRes.status).toBe(200);
})

test("POST new franchise", async() => {
    const franchiseName = `pizzaPocket~${Date.now()+' franchise'}`;

    const res = await request(app).post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`).send({
            name: franchiseName,
            admins: [{email: franchiseeEmail}]
        });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name', franchiseName);
})

test("GET franchises", async () =>{
    const res = await request(app)
        .get('/api/franchise')
        .query({ page: 0, limit: 10, name: '*' });
    
    expect(res.status).toBe(200);

})


test('GET franchises for user', async () => {

  const res = await request(app)
    .get(`/api/franchise/${adminId}`)
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBe(1);
  expect(res.body[0]).toHaveProperty('name');
});


test('DELETE store non-admin', async () => {
  const res = await request(app)
    .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(403);
});

test('DELETE store admin', async () => {
  const res = await request(app)
    .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({message: 'store deleted'});
});