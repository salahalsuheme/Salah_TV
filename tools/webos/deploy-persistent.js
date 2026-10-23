/**
 * Deploy homehook + cached IPK using Dev Manager SSH (prisoner:9922 + key).
 */
const fs = require('fs');
const path = require('path');
let Client;
try {
  ({ Client } = require('ssh2'));
} catch {
  ({ Client } = require(path.join(process.env.TEMP, 'tv-ssh', 'node_modules', 'ssh2')));
}

const TV = {
  host: '192.168.1.2',
  port: 9922,
  username: 'prisoner',
  keyPath: path.join(process.env.USERPROFILE || '', '.ssh', '366aea1ced'),
  passphrase: process.env.TV_SSH_PASS || '',
};
const toolsDir = __dirname;
const projectRoot = path.join(toolsDir, '..', '..');
const ipkLocal = [
  path.join(projectRoot, 'webos', 'build', 'Salah_Tv.ipk'),
  path.join(process.env.USERPROFILE || '', 'Downloads', 'Salah_Tv.ipk'),
].find((p) => fs.existsSync(p));
const STAGE = '/media/developer/temp/salah-deploy';

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', (d) => { out += d; process.stdout.write(d); });
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => (code ? reject(new Error('exit ' + code + ' ' + cmd)) : resolve(out)));
    });
  });
}

function hb(conn, command) {
  const esc = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return exec(conn, `luna-send -n 1 luna://org.webosbrew.hbchannel.service/exec "{\\"command\\":\\"${esc}\\"}"`);
}

function upload(conn, local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const ws = sftp.createWriteStream(remote);
      ws.on('error', reject);
      ws.on('close', resolve);
      fs.createReadStream(local).pipe(ws);
    });
  });
}

function uploadText(conn, text, remote) {
  const b64 = Buffer.from(text.replace(/\r\n/g, '\n'), 'utf8').toString('base64');
  return exec(conn, `mkdir -p ${STAGE} && printf '%s' '${b64}' | base64 -d > '${remote}'`);
}

const conn = new Client();
conn.on('ready', async () => {
  try {
    if (!ipkLocal) throw new Error('Salah_Tv.ipk not found — run package-salah-tv.ps1');
    await exec(conn, `mkdir -p ${STAGE}`);
    const names = ['watch-salah.sh', 'ensure-salah-app.sh', '55-ensure-salah', '60-homehook'];
    for (const n of names) {
      const local = path.join(toolsDir, n);
      process.stdout.write(`stage ${n}\n`);
      await upload(conn, local, `${STAGE}/${n}`);
    }
    process.stdout.write(`stage Salah_Tv.ipk\n`);
    await upload(conn, ipkLocal, `${STAGE}/Salah_Tv.ipk`);

    const sh = [
      'set -e',
      'mkdir -p /var/lib/homehook /var/lib/webosbrew/init.d',
      `cp -f ${STAGE}/watch-salah.sh /var/lib/homehook/watch.sh`,
      `cp -f ${STAGE}/ensure-salah-app.sh /var/lib/homehook/ensure-salah-app.sh`,
      `cp -f ${STAGE}/Salah_Tv.ipk /var/lib/homehook/Salah_Tv.ipk`,
      `cp -f ${STAGE}/55-ensure-salah /var/lib/webosbrew/init.d/55-ensure-salah`,
      `cp -f ${STAGE}/60-homehook /var/lib/webosbrew/init.d/60-homehook`,
      'chmod +x /var/lib/homehook/watch.sh /var/lib/homehook/ensure-salah-app.sh',
      'chmod +x /var/lib/webosbrew/init.d/55-ensure-salah /var/lib/webosbrew/init.d/60-homehook',
      'killall watch.sh 2>/dev/null || true',
      'sh /var/lib/webosbrew/init.d/55-ensure-salah',
      'sh /var/lib/webosbrew/init.d/60-homehook',
      'luna-send -i 120 luna://com.webos.appInstallService/dev/install "{\\"id\\":\\"com.salahalsuheme.salahtv\\",\\"ipkUrl\\":\\"/var/lib/homehook/Salah_Tv.ipk\\",\\"subscribe\\":true}"',
      'luna-send -n 1 luna://com.webos.applicationManager/launch "{\\"id\\":\\"com.salahalsuheme.salahtv\\"}"',
      'ls -la /var/lib/homehook',
    ].join('; ');
    process.stdout.write('elevate + install...\n');
    await hb(conn, sh);
    console.log('\nDone — persistent homehook deployed.');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    conn.end();
  }
}).on('error', (e) => {
  console.error('SSH:', e.message);
  process.exit(1);
}).connect({
  host: TV.host,
  port: TV.port,
  username: TV.username,
  privateKey: fs.readFileSync(TV.keyPath),
  passphrase: TV.passphrase,
  readyTimeout: 25000,
});
