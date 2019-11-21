const t = require('tap');
const mysql = require('../index.js');
const cfg = require('./config.js');
const db = mysql.createPool(cfg.conn);

const TABLE = 'users' + parseInt(process.env.TAP_CHILD_ID || 0);

(async () => {
  await db.waitConnection();
  await cfg.createTable(db, TABLE);
  
  let result = await db.insert(TABLE, { name: 'ab', code: 12 });
  t.equal(db.sql, 'INSERT INTO ' + TABLE + ' (`name`, `code`) VALUES (?, ?)');
  t.equal(JSON.stringify(db.values), JSON.stringify(['ab', 12]));
  t.equal(result.fieldCount, 0);
  t.equal(result.affectedRows, 1);
  t.equal(result.insertId, 1);
  t.equal(JSON.stringify(db.rows), JSON.stringify([]));
  t.equal(JSON.stringify(db.fields), JSON.stringify([]));
  t.equal(db.insertId, 1);
  t.equal(db.fieldCount, 0);
  t.equal(db.affectedRows, 1);
  t.equal(db.changedRows, 0);

  await db.end();
  t.pass('');
})();
