const t = require('tap');
const mysql = require('../index.js');
const cfg = require('./config.js');
const db = mysql.createPool(cfg.conn);

const TABLE = 'users' + parseInt(process.env.TAP_CHILD_ID || 0);

(async () => {
  await db.waitConnection();
  await cfg.createTable(db, TABLE);

  let result = await db.exists(TABLE, 'name = ?', 'not-exists');
  t.equal(db.sql, 'SELECT EXISTS(SELECT 1 FROM ' + TABLE + ' WHERE name = ? LIMIT 1)');
  t.equal(JSON.stringify(db.values), JSON.stringify(['not-exists']));
  t.equal(result, false);

  await db.end();
  t.pass('');
})();
