const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
const admin = {email: 'a@jwt.com', password: 'admin'};
let token;

beforeAll(async () =>{
    testUser.email = Math.random().toString(36).substring(2,12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    token = registerRes.body.token;
    expect(token).toBeDefined();

    const adminLoginRes = await request(app)
    .put('/api/auth')
    .send(admin);

  adminToken = adminLoginRes.body.token;
  expect(adminToken).toBeDefined();
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