/**
 * بعد Root + SSH (منفذ 22) من Homebrew:
 *   node tools/webos/install-salah-as-home.js
 * يرفع IPK إلى /var/lib/homehook ويعيد التثبيت تلقائياً إذا حذفه LG.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let Client;
try {
  ({ Client } = require('ssh2'));
} catch {
  ({ Client } = require(path.join(process.env.TEMP, 'tv-ssh', 'node_modules', 'ssh2')));
}

const TV = { host: '192.168.1.2', port: 22, user: 'root', pass: 'alpine' };
const toolsDir = path.join(__dirname);
const projectRoot = path.join(toolsDir, '..', '..');
const ipkLocal = [
  path.join(projectRoot, 'webos', 'build', 'Salah_Tv.ipk'),
  path.join(process.env.USERPROFILE || '', 'Downloads', 'Salah_Tv.ipk'),
].find((p) => fs.existsSync(p));
const files = [
  { local: 'watch-salah.sh', remote: '/var/lib/homehook/watch.sh' },
  { local: 'ensure-salah-app.sh', remote: '/var/lib/homehook/ensure-salah-app.sh' },
  { local: '52-salah-boot-burst.sh', remote: '/var/lib/webosbrew/init.d/52-salah-boot-burst' },
  { local: '55-ensure-salah', remote: '/var/lib/webosbrew/init.d/55-ensure-salah' },
  { local: '60-homehook', remote: '/var/lib/webosbrew/init.d/60-homehook' },
];

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', (d) => { out += d; process.stdout.write(d); });
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => (code ? reject(new Error(cmd + ' exit ' + code)) : resolve(out)));
    });
  });
}

function upload(conn, local, remote) {
  const text = fs.readFileSync(local, 'utf8').replace(/\r\n/g, '\n');
  const b64 = Buffer.from(text, 'utf8').toString('base64');
  return exec(conn, `printf '%s' '${b64}' | base64 -d > '${remote}'`);
}

function uploadBinary(conn, local, remote) {
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

const conn = new Client();
conn.on('ready', async () => {
  try {
    await exec(conn, 'mkdir -p /var/lib/homehook /var/lib/webosbrew/init.d');
    for (const f of files) {
      const local = path.join(toolsDir, f.local);
      process.stdout.write(`Upload ${f.local} -> ${f.remote}\n`);
      await upload(conn, local, f.remote);
    }
    await exec(
      conn,
      'chmod +x /var/lib/homehook/watch.sh /var/lib/homehook/ensure-salah-app.sh /var/lib/webosbrew/init.d/52-salah-boot-burst /var/lib/webosbrew/init.d/55-ensure-salah /var/lib/webosbrew/init.d/60-homehook'
    );
    if (!ipkLocal) {
      console.warn('Warning: Salah_Tv.ipk not found — build first; auto-reinstall skipped.');
    } else {
      const remoteIpk = '/var/lib/homehook/Salah_Tv.ipk';
      const hash = crypto.createHash('sha256').update(fs.readFileSync(ipkLocal)).digest('hex');
      process.stdout.write(`Upload IPK (${hash.slice(0, 12)}…) -> ${remoteIpk}\n`);
      await uploadBinary(conn, ipkLocal, remoteIpk);
      const installPayload = JSON.stringify({
        id: 'com.salahalsuheme.salahtv',
        ipkUrl: '/var/lib/homehook/Salah_Tv.ipk',
        subscribe: true,
      }).replace(/'/g, "'\\''");
      await exec(
        conn,
        `luna-send -n 1 luna://com.webos.appInstallService/dev/install '${installPayload}'`
      );
    }
    await exec(conn, 'killall watch.sh 2>/dev/null; sh /var/lib/webosbrew/init.d/55-ensure-salah; sh /var/lib/webosbrew/init.d/60-homehook');
    await exec(conn, "luna-send -n 1 luna://com.webos.applicationManager/launch '{\"id\":\"com.salahalsuheme.salahtv\"}'");
    console.log('\nDone — Home should open شاشة صلاح.');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    conn.end();
  }
}).on('error', (e) => {
  console.error('SSH failed:', e.message);
  process.exit(1);
}).connect({ host: TV.host, port: TV.port, username: TV.user, password: TV.pass, readyTimeout: 15000 });
