const t = require('tap');
const mysql = require('../index.js');
const cfg = require('./config.js');
const db = mysql.createPool(cfg.conn);

(async () => {
  await db.waitConnection();
  await db.end();
  t.pass('');
})();
