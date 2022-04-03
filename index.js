const SQL = require('like-sql')
const mysql = require('mysql2/promise')
// + support for sqlite?

module.exports = function (hostname, user, password, database, opts = {}) {
  return new LikePool(hostname, user, password, database, opts)
}

class MySQL extends SQL {
  constructor (opts = {}) {
    super(opts)

    this.charset = opts.charset === undefined ? 'utf8mb4' : opts.charset
    this.collate = opts.collate === undefined ? 'utf8mb4_unicode_ci' : opts.collate
    this.engine = opts.engine === undefined ? 'InnoDB' : opts.engine
  }

  async _createDatabase (sql) {
    const [res] = await this.execute(sql)
    return res.warningStatus === 0
  }

  async _dropDatabase (sql) {
    const [res] = await this.execute(sql)
    return res.warningStatus === 0
  }

  async _createTable (sql) {
    const [res] = await this.execute(sql)
    return res.warningStatus === 0
  }

  async _dropTable (sql) {
    const [res] = await this.execute(sql)
    return res.warningStatus === 0
  }

  async _insert (sql, values) {
    const [res] = await this.execute(sql, values)
    return res.insertId
  }

  async _select (sql, values) {
    const [res] = await this.execute(sql, values)
    return res
  }

  async _selectOne (sql, values) {
    const [res] = await this.execute(sql, values)
    return res.length ? res[0] : undefined
  }

  async _exists (sql, values) {
    const [res, fields] = await this.execute(sql, values)
    return !!res[0][fields[0].name]
  }

  async _count (sql, values) {
    const [res, fields] = await this.execute(sql, values)
    return res[0][fields[0].name]
  }

  async _update (sql, values) {
    const [res] = await this.execute(sql, values)
    return res.changedRows
  }

  async _delete (sql, values) {
    const [res] = await this.execute(sql, values)
    return res.affectedRows
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
}

class LikePool extends MySQL {
  constructor (hostname, user, password, database, opts = {}) {
    super(opts)

    const { host, port, socketPath } = MySQL.parseHostname(hostname)

    this.pool = mysql.createPool({
      host: host || '127.0.0.1',
      port: port || 3306,
      socketPath: socketPath || '',
      user: user || 'root',
      password: password || '',
      database: database || '',
      charset: this.collate, // in createPool options, charset is collate value
      supportBigNumbers: typeof opts.supportBigNumbers === 'boolean' ? opts.supportBigNumbers : true,
      bigNumberStrings: typeof opts.bigNumberStrings === 'boolean' ? opts.bigNumberStrings : false,
      decimalNumbers: typeof opts.decimalNumbers === 'boolean' ? opts.decimalNumbers : true,
      connectionLimit: opts.connectionLimit || 20,
      waitForConnections: typeof opts.waitForConnections === 'boolean' ? opts.waitForConnections : true,
      ssl: opts.ssl
    })
  }

  async getConnection () {
    const conn = await this.pool.getConnection()
    const db = new LikeConnection(conn)
    return db
  }

  async ready (timeout = 15000) {
    const started = Date.now()

    while (true) {
      try {
        const conn = await this.pool.getConnection()
        conn.release()
        break
      } catch (error) {
        if (error.code === 'ER_ACCESS_DENIED_ERROR') throw error
        if (error.code === 'ER_BAD_DB_ERROR') throw error
        if (error.message === 'No connections available.') throw error
        if (Date.now() - started > timeout) throw error

        await sleep(500)
      }
    }

    function sleep (ms) {
      return new Promise(resolve => setTimeout(resolve, ms))
    }
  }

  query (sql, values) {
    return this.pool.query(sql, values)
  }

  execute (sql, values) {
    return this.pool.execute(sql, values)
  }

  end () {
    return this.pool.end()
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
}

class LikeConnection extends MySQL {
  constructor (conn, opts = {}) {
    super(opts)

    this.connection = conn
  }

  query (sql, values) {
    return this.connection.query(sql, values)
  }

  execute (sql, values) {
    return this.connection.execute(sql, values)
  }

  end () {
    return this.connection.end()
  }

  destroy () {
    return this.connection.destroy()
  }

  beginTransaction () {
    return this.connection.beginTransaction()
  }

  commit () {
    return this.connection.commit()
  }

  rollback () {
    return this.connection.rollback()
  }

  release () {
    return this.connection.release()
  }
}

// mysqldump -h 127.0.0.1 --port=3307 -u root -p meli categories > categories.sql
// db.dump()
