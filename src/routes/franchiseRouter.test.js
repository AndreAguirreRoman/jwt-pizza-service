const request = require('supertest');
const app = require('../service');

const admin = {email: 'a@jwt.com', password: 'admin'};

let token;

beforeAll(async () => {
    const adminLoginRes = await request(app).put('/api/auth').send(admin);
    adminToken = adminLoginRes.body.token;
    expect(adminToken).toBeDefined();
})