const { Client } = require(require('path').join(process.env.TEMP, 'tv-ssh', 'node_modules', 'ssh2'));
function exec(conn, cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return resolve(1);
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => resolve(code || 0));
    });
  });
}
const id = 'com.salahalsuheme.salahtv';
const ipk = '/var/lib/homehook/Salah_Tv.ipk';
const c = new Client();
c.on('ready', async () => {
  await exec(c, `luna-send -n 1 luna://com.webos.appInstallService/dev/remove '{"id":"${id}"}'`);
  await new Promise((r) => setTimeout(r, 4000));
  await exec(c, `luna-send -n 1 luna://com.webos.appInstallService/dev/install '{"id":"${id}","ipkUrl":"${ipk}","subscribe":true}'`);
  await new Promise((r) => setTimeout(r, 8000));
  await exec(c, `grep version /media/developer/apps/usr/palm/applications/${id}/appinfo.json | head -1`);
  await exec(c, `luna-send -n 1 luna://com.webos.applicationManager/launch '{"id":"${id}"}'`);
  c.end();
}).connect({ host: '192.168.1.2', port: 22, username: 'root', password: 'alpine' });
