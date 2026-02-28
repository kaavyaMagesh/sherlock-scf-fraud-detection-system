const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/identity/revoke/1',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-lender-id': '1' // Assuming lenderAuth middleware checks this
    }
};

const req = http.request(options, res => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        console.log('Revoke VC Response:', res.statusCode, data);
    });
});
req.on('error', error => { console.error('Error:', error); });
req.end();

const options2 = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/invoices/1/disburse',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-lender-id': '1'
    }
};

const req2 = http.request(options2, res => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        console.log('Disburse Gate Response:', res.statusCode, data);
    });
});
req2.on('error', error => { console.error('Error:', error); });
req2.end();
