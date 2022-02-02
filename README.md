# like-mysql

Simple and intuitive ORM for MySQL

![](https://img.shields.io/npm/v/like-mysql.svg) ![](https://img.shields.io/npm/dt/like-mysql.svg) ![](https://img.shields.io/badge/tested_with-tape-e683ff.svg) ![](https://img.shields.io/github/license/LuKks/like-mysql.svg)

```javascript
const mysql = require('like-mysql')

// create a pool easily with good defaults
const db = mysql('127.0.0.1:3306', 'root', 'secret', 'myapp')

// wait until a connection is established
await db.ready()

// INSERT INTO `ips` (`addr`, `hits`) VALUES (?, ?)
const id = await db.insert('ips', { addr: req.ip, hits: 0 })

// SELECT `addr`, `hits` FROM `ips` WHERE addr = ?
const rows = await db.select('ips', ['addr', 'hits'], 'addr = ?', req.ip)

// SELECT `addr`, `hits` FROM `ips` WHERE addr = ? LIMIT 1
const row = await db.selectOne('ips', ['addr', 'hits'], 'addr = ?', req.ip)

// SELECT EXISTS(SELECT 1 FROM `ips` WHERE addr = ? LIMIT 1)
const exists = await db.exists('ips', 'addr = ?', req.ip)

// SELECT COUNT(1) FROM `ips` WHERE addr = ?
const count = await db.count('ips', 'addr = ?', req.ip)

// UPDATE `ips` SET `hits` = ? WHERE addr = ? LIMIT 1
await db.update('ips', { hits: 1 }, 'addr = ? LIMIT 1', req.ip)

// UPDATE `ips` SET `hits` = hits + ? WHERE addr = ?
await db.update('ips', [{ hits: 'hits + ?' }, 1], 'addr = ?', req.ip)

// DELETE FROM `ips` WHERE addr = ? LIMIT 1
await db.delete('ips', 'addr = ? LIMIT 1', req.ip)

// getConnection, beginTransaction, callback, commit/rollback, release
await db.transaction(async function (conn) {
  const user = await conn.insert('users', { username: 'lukks', ... })
  await conn.insert('profiles', { owner: user.insertId, ... })
})

// execute
const [rows, cols] = await db.execute('SELECT * FROM `ips` WHERE `addr` = ?', [req.ip])

// query
const [rows, cols] = await db.query('SELECT * FROM `ips` WHERE `addr` = "8.8.8.8"')

// end pool
await db.end()
```

## Install
```
npm i like-mysql
```

## Description
[node-mysql2](https://github.com/sidorares/node-mysql2) is used to create the MySQL pool.\
[like-sql](https://github.com/lukks/like-sql) is used to build the SQL queries.\
Operations are prepared statements made by `execute`.\
Promise version. All custom methods are also promised.

Automatic `WHERE` when `find` argument doesn't start with:\
`ORDER BY`, `LIMIT` or `GROUP BY`

## Examples
#### constructor
```javascript
// host:port
const db = mysql('127.0.0.1:3306', 'root', 'secret', 'mydb')

// socketPath
const db = mysql('/var/lib/mysql/mysql.sock', 'root', 'secret', 'mydb')
```

#### ready
Wait for database started by docker-compose, etc.
```javascript
// default timeout (15s)
await db.ready() // will throw in case is not able to connect

// custom timeout
await db.ready(5000)
```

#### insert
```javascript
// with autoincrement id:
const insertId = await db.insert('ips', { addr: req.ip, hits: 0 })
console.log(insertId) // => 1336

// otherwise it always returns zero:
const insertId = await db.insert('config', { key: 'title', value: 'Database' })
console.log(insertId) // => 0
```

#### select
```javascript
const rows = await db.select('ips', ['*'], 'addr = ?', req.ip)
console.log(rows) // => [{ id: 2, addr: '8.8.4.4', hits: 2 }]

const rows = await db.select('ips', ['addr', 'hits'], 'ORDER BY hits DESC')
console.log(rows) // => [{ addr: '8.8.8.8', hits: 6 }, { addr: '8.8.4.4', hits: 2 }, ...]
```

#### selectOne
```javascript
const row = await db.selectOne('ips', ['addr', 'hits'], 'addr = ?', req.ip)
console.log(row) // => { addr: '8.8.4.4', hits: 2 }

const row = await db.selectOne('ips', ['addr', 'hits'], 'addr = ?', '0.0.0.0')
console.log(row) // => undefined
```

#### exists
```javascript
const exists = await db.exists('ips', 'addr = ?', req.ip)
console.log(exists) // => true
```

#### count
```javascript
const total = await db.count('ips', 'addr = ?', req.ip)
console.log(total) // => 2
```

#### update
```javascript
const changedRows = await db.update('ips', { hits: 1 }, 'addr = ?', req.ip)
console.log(changedRows) // => 1

const changedRows = await db.update('ips', [{ hits: 'hits + ?' }, 1], 'addr = ?', req.ip)
console.log(changedRows) // => 1
```

#### delete
```javascript
const affectedRows = await db.delete('ips', 'addr = ?', req.ip)
console.log(affectedRows) // => 1
```

#### transaction
Normally with a pool you do something like:
- `conn = pool.getConnection()`
- `conn.beginTransaction()`
- `conn.execute('INSERT INTO users (username, password) VALUES (?, ?)')`
- `conn.execute('INSERT INTO profile (owner, name) VALUES (?, ?)')`
- `conn.commit()`
- `conn.release()`

Also checking different catchs to release and/or rollback.

This method simplifies all that and you just do the important part:
```javascript
await db.transaction(async function (conn) {
  const user = await conn.insert('users', { username: 'lukks', ... })
  await conn.insert('profiles', { owner: user.insertId, ... })
})
```

You can also return a custom value:
```javascript
const result = await db.transaction(async function (conn) {
  await conn.insert(...)
  return 'custom value'
})

console.log(result) // => 'custom value'
```

#### end
```javascript
await db.end()
```

## Tests
Start a database instance
```
docker run --rm -p 3305:3306 -e MYSQL_ROOT_USER=root -e MYSQL_ROOT_PASSWORD=secret -d mysql:8.0
```

Run tests
```
npm test
```

Stop container and due --rm will be auto deleted
```
docker ps
docker stop cc6
```

## License
Code released under the [MIT License](https://github.com/LuKks/like-mysql/blob/master/LICENSE).
