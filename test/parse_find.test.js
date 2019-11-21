const t = require('tap');
const mysql = require('../index.js');
const cfg = require('./config.js');
const db = mysql.createPool(cfg.conn);

const TABLE = 'users' + parseInt(process.env.TAP_CHILD_ID || 0);

(async () => {
  await db.waitConnection();
  await cfg.createTable(db, TABLE);

  await db.select(TABLE, ['name', 'code'], 'ORDER BY name ASC');
  t.equal(db.sql, 'SELECT `name`, `code` FROM ' + TABLE + ' ORDER BY name ASC');

  await db.select(TABLE, ['name', 'code'], 'LIMIT 1');
  t.equal(db.sql, 'SELECT `name`, `code` FROM ' + TABLE + ' LIMIT 1');

  await db.end();
  t.pass('');
})();
