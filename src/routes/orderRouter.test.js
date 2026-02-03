const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' }

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
let token;

let franchiseId;
let storeId;
let menuId;

beforeAll(async () =>{
    testUser.email = Math.random().toString(36).substring(2,12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    token = registerRes.body.token;
    expect(token).toBeDefined();

    const adminUser = await createAdminUser();

    const adminLoginRes = await request(app)
    .put('/api/auth')
    .send(adminUser);

  adminToken = adminLoginRes.body.token;
  expect(adminToken).toBeDefined();


  const menuRes = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'TestPizza', description: 't', image: 'x.png', price: 0.01 });

  const last = menuRes.body[menuRes.body.length - 1];
  menuId = last.id;

  const franchiseRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `Fr-${Date.now()}`, admins: [{ email: 'a@jwt.com' }] });

  franchiseId = franchiseRes.body.id;

  const storeRes = await request(app)
    .post(`/api/franchise/${franchiseId}/store`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `S-${Date.now()}` });

  storeId = storeRes.body.id;
});

test("GET menu", async () =>{
    const res = await request(app).get('/api/order/menu');
    expect(res.status).toBe(200);

    if (res.body.length > 0){
        const item = res.body[0]
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('title')
        expect(item).toHaveProperty('image')
        expect(item).toHaveProperty('price')
        expect(item).toHaveProperty('description')
    }
});

test("UPDATE menu item unauthorized", async () =>{
    const res = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${token}`)
    .send({ id: 1, title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 });

    expect(res.status).toBe(403);
})

test("UPDATE menu item authorized (admin)", async () =>{
    const res = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminToken}`)
    .send({ id: 1, title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0){
        const item = res.body[0]
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('title')
        expect(item).toHaveProperty('image')
        expect(item).toHaveProperty('price')
        expect(item).toHaveProperty('description')
    }
})

test("POST create order", async () => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ jwt: 'fake', reportUrl: 'http://example.com' }),
    });

    const order = {
        franchiseId,
        storeId,
        items: [{ menuId, description: 'TestPizza', price: 0.01 }],
    };

    const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${token}`)
        .send(order);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('order');
});