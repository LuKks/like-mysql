const t = require('tap');
const mysql = require('../index.js');
const cfg = require('./config.js');
const db = mysql.createPool(cfg.conn);

const TABLE = 'users' + parseInt(process.env.TAP_CHILD_ID || 0);

(async () => {
  await db.waitConnection();
  //await cfg.createTable(db, TABLE);

  await db.createTable('items', {
    id: { type: 'int', unsigned: true, required: true, increment: true, primary: true },
    fullname: { type: 'varchar', length: 64, collate: 'utf8mb4_unicode_ci', required: true },
    description: { type: 'varchar', length: 256, required: true },
    price: { type: 'decimal', length: [11, 2], required: true },
    dni: { type: 'int', unsigned: true, required: true },
    birthdate: { type: 'date', default: null },
    liq: { type: 'decimal(11,2)', required: true },
    cuit: { type: 'bigint', unsigned: true, required: true },
    posted: { type: 'tinyint', unsigned: true, required: true },
  }, {
    index: {
      person2: ['fullname,ASC', 'dni,ASC']
    },
    unique: {
      person_dni: ['dni', 'fullname']
    },
    engine: 'InnoDB',
    increment: 95406,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  });

  return;

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
