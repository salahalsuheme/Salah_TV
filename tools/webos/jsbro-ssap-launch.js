/**
 * Headless jsbro SSAP: connect + launch dangbei-overlay (needs TV pairing prompt once).
 * Run from tv-ssh folder: node ../../Projects/Salah_TV/tools/webos/jsbro-ssap-launch.js
 */
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const ip = process.argv[2] || '192.168.1.2';
const port = 3001;
const keyFile = path.join(__dirname, '.ssap-client-key');
const targetUrl =
  'https://raws0kil.github.io/jsbro-autoroot/resources/jsbro/';

let reqId = 1;
const pending = new Map();

function nextId(p) {
  return `${p}_${reqId++}`;
}

function send(ws, msg) {
  ws.send(JSON.stringify(msg));
}

function request(ws, uri, payload, timeoutMs = 20000) {
  const id = nextId('call');
  send(ws, { id, type: 'request', uri, payload });
  return new Promise((resolve) => {
    pending.set(id, resolve);
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve({ id, timeout: true });
      }
    }, timeoutMs);
  });
}

const clientKey = fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8').trim() : '';

const ws = new WebSocket(`wss://${ip}:${port}`, { rejectUnauthorized: false });

ws.on('open', () => {
  console.log('WS open — register (accept pairing on TV if prompted)');
  const reg = {
    id: nextId('register'),
    type: 'register',
    payload: {
      forcePairing: false,
      pairingType: 'PROMPT',
      manifest: {
        manifestVersion: 1,
        appVersion: '1.0',
        signed: {
          appId: 'com.example.ssap.dangbro',
          created: '2026-03-30',
          permissions: ['TEST_SECURE', 'READ_INSTALLED_APPS', 'LAUNCH'],
          vendorId: 'com.example',
        },
        permissions: ['LAUNCH', 'APP_TO_APP', 'READ_INSTALLED_APPS'],
        signatures: [{ signatureVersion: 1, signature: 'dangbro-local-demo' }],
      },
    },
  };
  if (clientKey) reg.payload['client-key'] = clientKey;
  send(ws, reg);
});

ws.on('message', async (data) => {
  let msg;
  try {
    msg = JSON.parse(data);
  } catch {
    return;
  }
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
    return;
  }
  if (msg.type === 'registered') {
    const key = msg.payload && msg.payload['client-key'];
    if (key) fs.writeFileSync(keyFile, key);
    console.log('Registered — launching dangbei-overlay');
    const res = await request(ws, 'ssap://system.launcher/launch', {
      id: 'com.webos.app.dangbei-overlay',
      params: { source: 'ssap-dangbro', target: targetUrl },
    });
    console.log(JSON.stringify(res, null, 2));
    if (res.type === 'response' && res.payload && res.payload.returnValue) {
      console.log('Launch OK — wait for TV dialog, then reboot and enable SSH in Homebrew.');
    } else {
      console.log('Launch may have failed — check TV or try jsbro in browser.');
    }
    setTimeout(() => ws.close(), 2000);
  }
  if (msg.type === 'error') {
    console.error('SSAP error:', msg.error || msg);
  }
});

ws.on('error', (e) => {
  console.error('WS error:', e.message);
  process.exit(1);
});
