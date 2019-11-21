/*
 like-mysql (https://npmjs.com/package/like-mysql)
 Copyright 2019 Lucas Barrena
 Licensed under MIT (https://github.com/LuKks/like-mysql)
*/

'use strict';

const mysql = require('mysql2/promise');

function insert (table, data) {
  let cols = Object.keys(data).map(c => '`' + c + '`').join(', ');
  let values = Object.values(data);
  let placeholders = Array(values.length).fill('?').join(', ');

  return execute.call(this, `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, values);
}

function select (table, cols, find, ...values) {
  cols = cols.map(c => '`' + c + '`').join(', ');
  find = parseFind(find);

  return execute.call(this, `SELECT ${cols} FROM ${table}${find}`, values);
}

function selectOne (table, cols, find, ...values) {
  cols = cols.map(c => '`' + c + '`').join(', ');
  find = parseFind(find);

  return execute.call(this, `SELECT ${cols} FROM ${table}${find} LIMIT 1`, values).then(() => {
    return this.rows.length ? this.rows[0] : undefined;
  });
}

function exists (table, find, ...values) {
  find = parseFind(find);

  return execute.call(this, `SELECT EXISTS(SELECT 1 FROM ${table}${find} LIMIT 1)`, values).then(() => {
    return this.rows[0][this.fields[0].name] ? true : false;
  });
}

function count (table, find, ...values) {
  find = parseFind(find);

  return execute.call(this, `SELECT COUNT(1) FROM ${table}${find}`, values).then(() => {
    return this.rows[0][this.fields[0].name];
  });
}

function update (table, data, find, ...values) {
  let set = [];
  let arithmetic = Array.isArray(data);
  let dataRef = arithmetic ? data[0] : data;
  for (let k in dataRef) {
    set.push('`' + k + '` = ' + (arithmetic ? dataRef[k] : '?'));
  }
  set = set.join(', ');
  find = parseFind(find);
  values.unshift(...Object.values(arithmetic ? data.slice(1) : data));

  return execute.call(this, `UPDATE ${table} SET ${set}${find}`, values);
}

function delet3 (table, find, ...values) {
  find = parseFind(find);

  return execute.call(this, `DELETE FROM ${table}${find}`, values);
}

/*
parseFind('id = ?'); // WHERE id = ?
parseFind('LIMIT 1'); // LIMIT 1
*/
function parseFind (find) {
  if (!find) return '';
  let known = ['ORDER BY', 'LIMIT', 'GROUP BY'].some(op => find.indexOf(op) === 0);
  return known ? (' ' + find) : (' WHERE ' + find);
}

function execute (sql, values) {
  return this.execute(sql, values).then(([res, fields]) => {
    this.sql = sql;
    this.values = values;
    if (fields) { // select
      this.rows = res;
      this.fields = fields;
    } else { // insert, update, delete
      this.insertId = res.insertId;
      this.fieldCount = res.fieldCount;
      this.affectedRows = res.affectedRows;
      // update
      if (typeof res.changedRows !== 'undefined') {
        this.changedRows = res.changedRows;
      }
    }
    return res;
  });
}

async function transaction (callback) {
  let conn = await this.getConnection();

  await releaseOnError.call(conn, conn.beginTransaction());

  try {
    await callback.call(conn, conn);
    await conn.commit();
  } catch (err) {
    await releaseOnError.call(conn, conn.rollback());

    conn.release();
    throw err;
  }

  conn.release();
}

async function releaseOnError (promise) {
  try {
    await promise;
  } catch (err) {
    this.release();
    throw err;
  }
}

function waitConnection (retry = 5, time = 500) {
  return new Promise((resolve, reject) => {
    this.getConnection().then(conn => {
      conn.release();
      resolve();
    }).catch(err => {
      if (!--retry) return reject(err);
      setTimeout(() => {
        this.waitConnection(retry, time).then(resolve).catch(reject);
      }, time);
    });
  });
}

[mysql.PromiseConnection, mysql.PromisePool].forEach(base => {
  let proto = {
    rows: [], fields: [],
    insertId: 0, fieldCount: 0, affectedRows: 0, changedRows: 0,
    insert, select, selectOne, exists, count, update, delete: delet3
  };

  for (let k in proto) base.prototype[k] = proto[k];
});

mysql.PromisePool.prototype.transaction = transaction;
mysql.PromisePool.prototype.waitConnection = waitConnection;

module.exports = mysql;
