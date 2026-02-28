const WebSocket = require('ws');

let wss;
const clients = new Set();
const ALERT_BUFFER_SIZE = 50;
const alertBuffer = []; // in-memory ring buffer

function addToBuffer(alert) {
    alertBuffer.push(alert);
    if (alertBuffer.length > ALERT_BUFFER_SIZE) {
        alertBuffer.shift(); // drop oldest
    }
}

function broadcast(alert) {
    addToBuffer(alert);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'ALERT', alert }));
        }
    });
}

function init(server) {
    wss = new WebSocket.Server({ server });

    // On new connection — replay history
    wss.on('connection', (socket) => {
        clients.add(socket);
        socket.send(JSON.stringify({ type: 'HISTORY', alerts: alertBuffer }));

        socket.on('close', () => clients.delete(socket));
    });

    console.log("WebSocket Server Initialized with Ring Buffer");
}

module.exports = {
    init,
    broadcast
};
