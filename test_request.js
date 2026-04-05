const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = 'sherlock-super-secret-key-123';

// Mocking a buyer token based on our earlier diagnostic (buyer ID 3)
const token = jwt.sign(
    { 
        id: 1, 
        company_id: 3, 
        lender_id: 1, 
        role: 'BUYER' 
    }, 
    JWT_SECRET
);

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/erp/buyer-invoices',
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${token}`,
        'x-lender-id': 1
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        console.log('Response Body:', data);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
