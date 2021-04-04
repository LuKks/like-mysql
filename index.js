/*
 like-mysql (https://npmjs.com/package/like-mysql)
 Copyright 2019 Lucas Barrena
 Licensed under MIT (https://github.com/LuKks/like-mysql)
*/

'use strict';

/*
CREATE DATABASE IF NOT EXISTS `meli` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
db.createDatabase('meli', {
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
});
*/
function createDatabase (name, options) {
  options = Object.assign({
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  }, options);

  return execute.call(this, `CREATE DATABASE IF NOT EXISTS \`${name}\` DEFAULT CHARACTER SET ${options.charset} COLLATE ${options.collate}`);
}

function createTable (name, columns, options) {
  let database = this.pool.config.connectionConfig.database;

  // defaults
  let primaryKeys = [];
  let { index, unique, engine, increment, charset, collate } = Object.assign({
    index: {},
    unique: {},
    engine: 'InnoDB',
    increment: undefined,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  }, options);

  // columns
  for (let colName in columns) {
    columns[colName] = parseColumn(colName, columns[colName]);
  }
  columns = Object.values(columns).join(',\n');

  // primary keys
  if (primaryKeys.length) {
    primaryKeys = primaryKeys.map(colName => '`' + colName + '`').join(', ');
    primaryKeys = `,\n  PRIMARY KEY (${primaryKeys})`;
  } else {
    primaryKeys = '';
  }

  // index
  if (Object.keys(index).length) {
    index = parseIndex('INDEX', index);
    index = ',\n' + Object.values(index).join(',\n');
  } else {
    index = '';
  }

  // unique
  if (Object.keys(unique).length) {
    unique = parseIndex('UNIQUE KEY', unique);
    unique = ',\n' + Object.values(unique).join(',\n');
  } else {
    unique = '';
  }

  // options
  engine = engine ? (' ENGINE=' + engine) : '';
  increment = increment !== undefined ? (' AUTO_INCREMENT=' + increment) : '';
  charset = charset ? (' CHARSET=' + charset) : '';
  collate = collate ? (' COLLATE=' + collate) : '';

  // create table
  return execute.call(this, `CREATE TABLE IF NOT EXISTS \`${database}\`.\`${name}\` (
${columns}${primaryKeys}${index}${unique}
)${engine}${increment}${charset}${collate}`);

  function parseColumn (name, value) {
    // inline, for example { price: 'decimal(11,2) NOT NULL' }
    /*if (typeof value === 'string') {
      return `\`${name}\` ${value}`; // disabled because complexity detecting primary keys, etc
    }*/

    // object, for example { price: { type: 'decimal', length: [11, 2], required: true } }
    let { type, length, unsigned, collate, required/*, default*/, increment, primary } = value;

    if (!type) {
      type = 'int';
    }

    if (length) {
      // multi length for DECIMAL(11,2), etc
      if (Array.isArray(length)) {
        // add quotes only on strings, support for ENUM('a', 'b')
        length = length.map(len => typeof len === 'string' ? `'${len}'` : len);
        // join lengths or values
        length = length.join(',');
      }
      length = ' (' + length + ')';
    } else {
      length = '';
    }

    unsigned = unsigned ? ' unsigned' : '';

    collate = collate ? (' COLLATE ' + collate) : '';

    required = required || primary ? ' NOT NULL' : ' NULL';

    if (typeof value.default !== 'undefined' && !increment) {
      // strings have simple quotes
      if (typeof value.default === 'string') {
        value.default = `'${value.default}'`
      }
      // it's just uppercase for null
      if (value.default === null) {
        value.default = 'NULL';
      }
      value.default = ' DEFAULT ' + value.default;
    } else {
      value.default = '';
    }

    increment = increment ? ' AUTO_INCREMENT' : '';

    // if, add to primary keys
    primary && primaryKeys.push(name);

    return `  \`${name}\` ${type}${length}${unsigned}${collate}${required}${value.default}${increment}`;
  }

  function parseIndex (type, index) {
    for (let key in index) {
      let columns = index[key];

      // for example: ['fullname,ASC', 'dni', 'birthdate,DESC']
      columns = columns.map(column => {
        let [colName, order] = column.split(',');
        return `\`${colName}\` ${order || 'ASC'}`;
      }).join(', ');

      // INDEX `key1` (`fullname` ASC, `dni` ASC, `birthdate` DESC),
      index[key] = `  ${type} \`${key}\` (${columns})`;
    }

    return index;
  }
}

// db.deleteDatabase('meli');
// db.deleteTable('items');

// mysqldump -h 127.0.0.1 --port=3307 -u root -p meli categories > categories.sql
// db.dump();

const mysql = require('mysql2/promise');

function insert (table, data) {
  let cols = Object.keys(data).map(c => '`' + c + '`').join(', ');
  let values = Object.values(data);
  let placeholders = Array(values.length).fill('?').join(', ');

  return execute.call(this, `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, values);
}

function select (table, cols, find, ...values) {
  cols = cols.map(c => (c === '*') ? c : ('`' + c + '`')).join(', ');
  find = parseFind(find);

  return execute.call(this, `SELECT ${cols} FROM ${table}${find}`, values);
}

function selectOne (table, cols, find, ...values) {
  cols = cols.map(c => (c === '*') ? c : ('`' + c + '`')).join(', ');
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
  console.log('execute');
  console.log(sql);

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

/*
// socketPath
let db = mysql.createLink('/var/lib/mysql/mysql.sock', 'root', 'hwwwy123', 'forex', {
// host:port
let db = mysql.createLink('127.0.0.1:3306', 'root', 'hwwwy123', 'forex', {
  charset: 'utf8mb4_unicode_ci',
  supportBigNumbers: true,
  decimalNumbers: true,
  connectionLimit: 50
});
*/
function createLink (host, user, password, database, options) {
  let port;
  let socketPath;

  let semicolon = host.indexOf(':');
  if (semicolon > -1) { // host:port
    port = host.substr(semicolon + 1);
    host = host.substr(0, semicolon);
  } else { // socket path
    socketPath = host;
    host = '';
  }

  options = Object.assign({
    host: host || '127.0.0.1',
    port: port || 3306,
    socketPath: socketPath || '',
    user: user || 'root',
    password: password || '',
    database: database || '',
    charset: 'utf8mb4_unicode_ci',
    supportBigNumbers: true,
    decimalNumbers: true,
    connectionLimit: 50
  }, options);

  return mysql.createPool(options);
}

function waitConnection (retry = 10, time = 500) {
  return new Promise(async (resolve, reject) => {
    try {
      let conn = await this.getConnection();
      conn.release();
      resolve();
    } catch (err) {
      if (!--retry) {
        reject(err);
        return;
      }
      setTimeout(() => {
        this.waitConnection(retry, time).then(resolve).catch(reject);
      }, time);
    }
  });
}

mysql.createLink = createLink;
mysql.PromisePool.prototype.waitConnection = waitConnection;

[mysql.PromiseConnection, mysql.PromisePool].forEach(base => {
  let proto = {
    rows: [], fields: [],
    insertId: 0, fieldCount: 0, affectedRows: 0, changedRows: 0,
    createDatabase, createTable,
    insert, select, selectOne, exists, count, update, delete: delet3
  };

  for (let k in proto) base.prototype[k] = proto[k];
});

mysql.PromisePool.prototype.transaction = transaction;

module.exports = mysql;
