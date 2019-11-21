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
  
  let result = await db.delete(TABLE, 'name = ?', 'ab');
  t.equal(db.sql, 'DELETE FROM ' + TABLE + ' WHERE name = ?');
  t.equal(JSON.stringify(db.values), JSON.stringify(['ab']));
  t.equal(result.fieldCount, 0);
  t.equal(result.affectedRows, 1);
  t.equal(result.insertId, 0);
  t.equal(JSON.stringify(db.rows), JSON.stringify([]));
  t.equal(JSON.stringify(db.fields), JSON.stringify([]));
  t.equal(db.insertId, 0);
  t.equal(db.fieldCount, 0);
  t.equal(db.affectedRows, 1);
  t.equal(db.changedRows, 0);

  await db.end();
  t.pass('');
})();
