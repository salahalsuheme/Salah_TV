const path = require('path');
let Client;
try {
  ({ Client } = require('ssh2'));
} catch {
  ({ Client } = require(path.join(process.env.TEMP, 'tv-ssh', 'node_modules', 'ssh2')));
}
const TV = { host: '192.168.1.2', port: 22, username: 'root', password: 'alpine' };
const cmd = "luna-send -n 1 luna://com.webos.applicationManager/listLaunchPoints '{}'";

const conn = new Client();
conn
  .on('ready', () => {
    conn.exec(cmd, (err, stream) => {
      if (err) throw err;
      let out = '';
      stream.on('data', (d) => { out += d; });
      stream.on('close', () => {
        try {
          const j = JSON.parse(out);
          const pts = (j.launchPoints || []).map((p) => ({
            id: p.id,
            title: p.title || p.appId || '',
          }));
      const q = process.argv[2] || 'browser|enact|web|internet|متصفح';
      const re = new RegExp(q, 'i');
      const hit = pts.filter((p) => re.test(p.id + ' ' + p.title));
      console.log(JSON.stringify(hit, null, 2));
        } catch (e) {
          console.error(out.slice(0, 4000));
        }
        conn.end();
      });
    });
  })
  .on('error', (e) => {
    console.error(e.message);
    process.exit(1);
  })
  .connect({ ...TV, readyTimeout: 15000 });
