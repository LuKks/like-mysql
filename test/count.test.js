const t = require('tap');
const mysql = require('../index.js');
const cfg = require('./config.js');
const db = mysql.createPool(cfg.conn);

const TABLE = 'users' + parseInt(process.env.TAP_CHILD_ID || 0);

(async () => {
  await db.waitConnection();
  await cfg.createTable(db, TABLE);
  await db.insert(TABLE, { name: 'ab', code: 12 });
  await db.insert(TABLE, { name: 'cd', code: 34 });
  await db.insert(TABLE, { name: 'ab', code: 56 });

  let result = await db.count(TABLE, 'name = ?', 'ab');
  t.equal(db.sql, 'SELECT COUNT(1) FROM ' + TABLE + ' WHERE name = ?');
  t.equal(JSON.stringify(db.values), JSON.stringify(['ab']));
  t.equal(result, 2);
  t.equal(JSON.stringify(db.rows), JSON.stringify([
    { 'COUNT(1)': 2 }
  ]));

  await db.end();
  t.pass('');
})();
