const t = require('tap');
const mysql = require('../index.js');
const cfg = require('./config.js');
const db = mysql.createPool(Object.assign(cfg.conn, { connectionLimit: 1, waitForConnections: false }));

(async () => {
  let conn = await db.getConnection();

  await t.rejects(db.waitConnection());

  conn.release();
  await db.end();
  t.pass('');
})();
