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
  
  await db.transaction(async function (conn) {
    await conn.delete(TABLE, 'name = ?', 'ab');
    await conn.delete(TABLE, 'name = ?', 'cd');
  });

  let results = await db.select(TABLE, ['*']);
  t.equal(results.length, 0);

  await db.end();
  t.pass('');
})();
