const request = require('supertest');
const express = require('express');
const app = express();

// Simple mock of the health endpoint for testing
app.get('/health', (req, res) => {
    res.json({ status: 'active', engine: 'AI Gym Trainer Backend' });
});

describe('GET /health', () => {
    it('should return 200 and a healthy status', async () => {
        const response = await request(app).get('/health');
        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe('active');
    });
});
