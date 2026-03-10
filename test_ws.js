// Test WebSocket connection to the Render server
// Node 22 has native WebSocket support
const ws = new WebSocket('wss://foreva-server.onrender.com');

ws.addEventListener('open', () => {
  console.log('WS OPEN');
  ws.send(JSON.stringify({
    type: 'join',
    joinToken: 'test',
    userId: 'test-ws-123',
    name: 'WSTester',
    language: 'en'
  }));
});

ws.addEventListener('message', (event) => {
  console.log('MSG:', event.data);
  ws.close();
});

ws.addEventListener('error', (e) => {
  console.error('ERR:', e.message || e);
});

ws.addEventListener('close', () => {
  console.log('CLOSED');
  process.exit(0);
});

setTimeout(() => {
  console.log('TIMEOUT - no response after 10s');
  process.exit(1);
}, 10000);
