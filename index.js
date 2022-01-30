const mysql = require('mysql2/promise')
// + support for sqlite?

class LikeMySQL {
  /*
  // socketPath
  const db = new mysql('/var/lib/mysql/mysql.sock', 'root', 'secret', 'forex')

  // host:port
  const db = new mysql('127.0.0.1:3306', 'root', 'secret', 'forex')
  */
  constructor (hostname, user, password, database, opts = {}) {
    const { host, port, socketPath } = LikeMySQL.parseHostname(hostname)

    this.charset = opts.charset || 'utf8mb4'
    this.collate = opts.collate || 'utf8mb4_unicode_ci'
    this.engine = opts.engine || 'InnoDB'

    this.pool = mysql.createPool({
      host: host || '127.0.0.1',
      port: port || 3306,
      socketPath: socketPath || '',
      user: user || 'root',
      password: password || '',
      database: database || '',
      charset: this.collate, // in createPool options, charset is collate value
      supportBigNumbers: typeof opts.supportBigNumbers === 'boolean' ? opts.supportBigNumbers : true,
      decimalNumbers: typeof opts.decimalNumbers === 'boolean' ? opts.decimalNumbers : true,
      connectionLimit: opts.connectionLimit || 20,
      waitForConnections: typeof opts.waitForConnections === 'boolean' ? opts.waitForConnections : true
    })
  }

  getConnection () {
    return this.pool.getConnection()
  }

  end () {
    return this.pool.end()
  }

  query (sql) {
    this.sql = sql
    this.values = undefined
    return this.pool.query(sql)
  }

  execute (sql, values) {
    this.sql = sql
    this.values = values
    return this.pool.execute(sql, values)
  }

  async createDatabase (name, opts = {}) {
    opts.charset = opts.charset || this.charset
    opts.collate = opts.collate || this.collate

    const sql = `CREATE DATABASE IF NOT EXISTS \`${name}\` DEFAULT CHARACTER SET ${opts.charset} COLLATE ${opts.collate}`
    const [res] = await this.execute(sql)
    return res
  }

  async dropDatabase (name) {
    const sql = `DROP DATABASE IF EXISTS \`${name}\``
    const [res] = await this.execute(sql)
    return res
  }

  async createTable (name, columns, options) {
    const database = this.pool.config.connectionConfig.database

    // defaults
    let primaryKeys = []
    let { unique, index, engine, increment, charset, collate } = Object.assign({
      unique: {},
      index: {},
      engine: this.engine,
      increment: undefined,
      charset: this.charset,
      collate: this.collate
    }, options)

    // columns
    for (const colName in columns) {
      columns[colName] = LikeMySQL.parseColumn(colName, columns[colName], primaryKeys)
    }
    columns = Object.values(columns).join(',\n')

    // primary keys
    if (primaryKeys.length) {
      primaryKeys = primaryKeys.map(colName => '`' + colName + '`').join(', ')
      primaryKeys = `,\n  PRIMARY KEY (${primaryKeys})`
    } else {
      primaryKeys = ''
    }

    // unique
    if (Object.keys(unique).length) {
      unique = LikeMySQL.parseIndex('UNIQUE KEY', unique)
      unique = ',\n' + Object.values(unique).join(',\n')
    } else {
      unique = ''
    }

    // index
    if (Object.keys(index).length) {
      index = LikeMySQL.parseIndex('INDEX', index)
      index = ',\n' + Object.values(index).join(',\n')
    } else {
      index = ''
    }

    // options
    engine = engine ? (' ENGINE=' + engine) : ''
    increment = increment !== undefined ? (' AUTO_INCREMENT=' + increment) : ''
    charset = charset ? (' CHARSET=' + charset) : ''
    collate = collate ? (' COLLATE=' + collate) : ''

    // create table
    const sql = `CREATE TABLE IF NOT EXISTS \`${database}\`.\`${name}\` (${columns}${primaryKeys}${unique}${index})${engine}${increment}${charset}${collate}`
    const [res] = await this.execute(sql)
    return res
  }

  async dropTable (name) {
    const database = this.pool.config.connectionConfig.database

    const sql = `DROP TABLE IF EXISTS \`${database}\`.\`${name}\``
    const [res] = await this.execute(sql)
    return res
  }

  async insert (table, data) {
    const cols = Object.keys(data).map(c => '`' + c + '`').join(', ')
    const values = Object.values(data)
    const placeholders = Array(values.length).fill('?').join(', ')

    const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`
    const [res] = await this.execute(sql, values)
    return res
  }

  async select (table, cols, find, ...values) {
    cols = cols.map(c => (c === '*') ? c : ('`' + c + '`')).join(', ')
    find = LikeMySQL.parseFind(find)

    const sql = `SELECT ${cols} FROM ${table}${find}`
    const [res] = await this.execute(sql, values)
    return res
  }

  async selectOne (table, cols, find, ...values) {
    cols = cols.map(c => (c === '*') ? c : ('`' + c + '`')).join(', ')
    find = LikeMySQL.parseFind(find)

    const sql = `SELECT ${cols} FROM ${table}${find} LIMIT 1`
    const [res] = await this.execute(sql, values)
    return res.length ? res[0] : undefined
  }

  async exists (table, find, ...values) {
    find = LikeMySQL.parseFind(find)

    const sql = `SELECT EXISTS(SELECT 1 FROM ${table}${find} LIMIT 1)`
    const [res, fields] = await this.execute(sql, values)
    return !!res[0][fields[0].name]
  }

  async count (table, find, ...values) {
    find = LikeMySQL.parseFind(find)

    const sql = `SELECT COUNT(1) FROM ${table}${find}`
    const [res, fields] = await this.execute(sql, values)
    return res[0][fields[0].name]
  }

  async update (table, data, find, ...values) {
    let set = []
    const arithmetic = Array.isArray(data)
    const dataRef = arithmetic ? data[0] : data
    for (const k in dataRef) {
      set.push('`' + k + '` = ' + (arithmetic ? dataRef[k] : '?'))
    }
    set = set.join(', ')
    find = LikeMySQL.parseFind(find)
    values.unshift(...Object.values(arithmetic ? data.slice(1) : data))

    const sql = `UPDATE ${table} SET ${set}${find}`
    const [res] = await this.execute(sql, values)
    return res
  }

  async delete (table, find, ...values) {
    find = LikeMySQL.parseFind(find)

    const sql = `DELETE FROM ${table}${find}`
    const [res] = await this.execute(sql, values)
    return res
  }

  async transaction (callback) {
    const conn = await this.getConnection()
    let output

    await releaseOnError(conn, conn.beginTransaction())

    try {
      output = await callback(conn)
      await conn.commit()
    } catch (err) {
      await releaseOnError(conn, conn.rollback())

      conn.release()
      throw err
    }

    conn.release()

    return output

    function releaseOnError (conn, promise) {
      return promise.catch(err => {
        conn.release()
        throw err
      })
    }
  }

  async waitConnection (timeout = 15000) {
    const started = Date.now()

    while (true) {
      try {
        const conn = await this.getConnection()
        conn.release()
        break
      } catch (err) {
        if (Date.now() - started > timeout) {
          throw err
        }

        await sleep(500)
      }
    }

    function sleep (ms) {
      return new Promise(resolve => setTimeout(resolve, ms))
    }
  }

  static parseColumn (name, value, primaryKeys) {
    // inline, for example { price: 'decimal(11,2) NOT NULL' }
    /*
    if (typeof value === 'string') {
      return `\`${name}\` ${value}` // disabled due complexity detecting primary keys, etc
    }
    */

    // object, for example { price: { type: 'decimal', length: [11, 2], required: true } }
    let { type, length, unsigned, collate, required, defaultt = value.default, increment, primary } = value
    // "default" is a keyword, it can't be a variable

    if (!type) {
      type = 'int'
    }

    if (length) {
      // multi length for DECIMAL(11,2), etc
      if (Array.isArray(length)) {
        // add quotes only on strings, support for ENUM('a', 'b')
        length = length.map(len => typeof len === 'string' ? `'${len}'` : len)
        // join lengths or values
        length = length.join(',')
      }
      length = ' (' + length + ')'
    } else {
      length = ''
    }

    unsigned = unsigned ? ' unsigned' : ''

    collate = collate ? (' COLLATE ' + collate) : ''

    required = required || primary ? ' NOT NULL' : ' NULL'

    if (typeof defaultt !== 'undefined' && !increment) {
      // strings have simple quotes
      if (typeof defaultt === 'string') {
        defaultt = `'${defaultt}'`
      }
      // it's just uppercase for null
      if (defaultt === null) {
        defaultt = 'NULL'
      }
      defaultt = ' DEFAULT ' + defaultt
    } else {
      defaultt = ''
    }

    increment = increment ? ' AUTO_INCREMENT' : ''

    // if, add to primary keys
    primary && primaryKeys.push(name)

    return `  \`${name}\` ${type}${length}${unsigned}${collate}${required}${defaultt}${increment}`
  }

  static parseIndex (type, index) {
    for (const key in index) {
      let columns = index[key]

      // for example: ['fullname ASC', 'dni', 'birthdate DESC']
      columns = columns.map(column => {
        const [colName, order] = column.split(' ')
        return `\`${colName}\` ${order || 'ASC'}`
      }).join(', ')

      // INDEX `key1` (`fullname` ASC, `dni` ASC, `birthdate` DESC),
      index[key] = `  ${type} \`${key}\` (${columns})`
    }

    return index
  }

  static parseHostname (host) {
    let port
    let socketPath
    const semicolon = host.indexOf(':')
    if (semicolon > -1) { // host:port
      port = host.substr(semicolon + 1)
      host = host.substr(0, semicolon)
    } else { // socket path
      socketPath = host
      host = ''
    }
    return { host, port, socketPath }
  }

  // parseFind('id = ?') // WHERE id = ?
  // parseFind('LIMIT 1') // LIMIT 1
  static parseFind (find) {
    if (!find) return ''
    const known = ['ORDER BY', 'LIMIT', 'GROUP BY'].some(op => find.indexOf(op) === 0)
    return known ? (' ' + find) : (' WHERE ' + find)
  }
}

module.exports = LikeMySQL

// mysqldump -h 127.0.0.1 --port=3307 -u root -p meli categories > categories.sql
// db.dump()
