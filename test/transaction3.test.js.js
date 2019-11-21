const t = require('tap');
const mysql = require('../index.js');
const cfg = require('./config.js');
const db = mysql.createPool(Object.assign(cfg.conn, { connectionLimit: 1, waitForConnections: false }));

const TABLE = 'users' + parseInt(process.env.TAP_CHILD_ID || 0);

(async () => {
  await db.waitConnection();
  await cfg.createTable(db, TABLE);
  await db.insert(TABLE, { name: 'ab', code: 12 });
  await db.insert(TABLE, { name: 'cd', code: 34 });
  
  await t.rejects(db.transaction(async function (conn) {
    await conn.delete(TABLE, 'name = ?', 'ab');
    await conn.delete(TABLE, 'name = ?', 'cd');
    await conn.destroy();
  }));

  let results = await db.select(TABLE, ['*']);
  t.equal(results.length, 2);
  
  await db.end();
  t.pass('');
})();
