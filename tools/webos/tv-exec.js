/** Run one command on TV via Dev Manager SSH key (prisoner@9922). */
const fs = require('fs');
const path = require('path');
let Client;
try {
  ({ Client } = require('ssh2'));
} catch {
  ({ Client } = require(path.join(process.env.TEMP, 'tv-ssh', 'node_modules', 'ssh2')));
}

const keyPath = path.join(process.env.USERPROFILE || '', '.ssh', '366aea1ced');
const passphrase = process.env.TV_SSH_PASS || '';
const cmd = process.argv.slice(2).join(' ') || 'id; ls -la /var/lib/homehook 2>/dev/null; ls /media/developer/apps/usr/palm/applications/com.salahalsuheme.salahtv 2>/dev/null | head -3';

const conn = new Client();
conn
  .on('ready', () => {
    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error(err.message);
        conn.end();
        process.exit(1);
      }
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        conn.end();
        process.exit(code || 0);
      });
    });
  })
  .on('error', (e) => {
    console.error('SSH:', e.message);
    process.exit(1);
  })
  .connect({
    host: '192.168.1.2',
    port: 9922,
    username: 'prisoner',
    privateKey: fs.readFileSync(keyPath),
    passphrase,
    readyTimeout: 20000,
  });
