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

  let result = await db.exists(TABLE, 'name = ?', 'ab');
  t.equal(db.sql, 'SELECT EXISTS(SELECT 1 FROM ' + TABLE + ' WHERE name = ? LIMIT 1)');
  t.equal(JSON.stringify(db.values), JSON.stringify(['ab']));
  t.equal(result, true);
  t.equal(JSON.stringify(db.rows), JSON.stringify([
    { ['EXISTS(SELECT 1 FROM ' + TABLE + ' WHERE name = ? LIMIT 1)']: 1 }
  ]));

  await db.end();
  t.pass('');
})();
