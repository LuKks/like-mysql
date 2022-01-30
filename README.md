# like-mysql

Simple and intuitive ORM for MySQL

![](https://img.shields.io/npm/v/like-mysql.svg) ![](https://img.shields.io/npm/dt/like-mysql.svg) ![](https://img.shields.io/badge/tested_with-tap-e683ff.svg) ![](https://img.shields.io/github/license/LuKks/like-mysql.svg)

```javascript
const mysql = require('like-mysql')

// create a pool easily with good defaults
const db = new mysql('127.0.0.1:3306', 'root', 'secret', 'myapp')

// wait until a connection is established
await db.available()

// CREATE DATABASE IF NOT EXISTS `myapp` ...
await db.createDatabase('myapp')

// CREATE TABLE IF NOT EXISTS `myapp`.`ips` (...)
await db.createTable('ips', {
  id: { type: 'int', unsigned: true, increment: true, primary: true },
  addr: { type: 'varchar', length: 16, required: true, index: true },
  hits: { type: 'int', unsigned: true, default: 0 }
})

// INSERT INTO ips (addr, hits) VALUES (?, ?)
await db.insert('ips', { addr: req.ip, hits: 0 })

// SELECT addr, hits FROM ips WHERE addr = ?
await db.select('ips', ['addr', 'hits'], 'addr = ?', req.ip)

// SELECT addr, hits FROM ips WHERE addr = ? LIMIT 1
await db.selectOne('ips', ['addr', 'hits'], 'addr = ?', req.ip)

// SELECT EXISTS(SELECT 1 FROM ips WHERE addr = ? LIMIT 1)
await db.exists('ips', 'addr = ?', req.ip)

// SELECT COUNT(1) FROM ips WHERE addr = ?
await db.count('ips', 'addr = ?', req.ip)

// UPDATE ips SET hits = ? WHERE addr = ?
await db.update('ips', { hits: 1 }, 'addr = ?', req.ip)

// UPDATE ips SET hits = hits + ? WHERE userid = ?
await db.update('ips', [{ hits: 'hits + ?' }, 1], 'addr = ?', req.ip)

// DELETE FROM ips WHERE addr = ?
await db.delete('ips', 'addr = ?', req.ip)

// getConnection, beginTransaction, callback, commit/rollback, release
await db.transaction(async function (conn) {
  const user = await conn.insert('users', { username: 'lukks', password: 'hwy123' })
  await conn.insert('profiles', { owner: user.insertId, name: 'Lucas' })
})

// execute
await db.execute('SELECT * FROM `ips` WHERE `addr` = ?', [req.ip])

// query
await db.query('SELECT * FROM `ips` WHERE `addr` = "8.8.8.8"')

// DROP TABLE IF EXISTS `myapp`.`ips`
await db.dropTable('ips')

// DROP DATABASE IF EXISTS `myapp`
await db.dropDatabase('myapp')
```

## Install
```
npm i like-mysql
```

## Features
[sidorares/node-mysql2](https://github.com/sidorares/node-mysql2) is used internally.\
Operations are prepared statements made by `execute`.\
Promise version. All custom methods are also promised.

Automatic `WHERE` when `find` argument doesn't start with:\
`ORDER BY`, `LIMIT` or `GROUP BY`

## Examples
#### available
Wait for database started by docker-compose, etc.
```javascript
db.available().then(main)

async function main () {
  await db.query('...')
}
```

#### insert
```javascript
const ip = await db.insert('ips', { addr: req.ip, hits: 0 })
console.log(ip) // { fieldCount: 0, affectedRows: 1, insertId: 1336, ... }
```

#### select
```javascript
const rows = await db.select('ips', ['*'], 'addr = ?', req.ip)
console.log(rows) // [{ id: 2, addr: '8.8.4.4', hits: 2 }]

const rows = await db.select('ips', ['addr', 'hits'], 'ORDER BY hits DESC')
console.log(rows) // [{ addr: '8.8.8.8', hits: 6 }, { addr: '8.8.4.4', hits: 2 }, ...]
```

#### selectOne
```javascript
const ip = await db.selectOne('ips', ['addr', 'hits'], 'addr = ?', req.ip)
console.log(ip) // { addr: '8.8.4.4', hits: 2 }

const ip = await db.selectOne('ips', ['addr', 'hits'], 'addr = ?', '0.0.0.0')
console.log(ip) // undefined
```

#### exists
```javascript
const exists = await db.exists('ips', 'addr = ?', req.ip)
console.log(exists) // true
```

#### count
```javascript
const total = await db.count('ips', 'addr = ?', req.ip)
console.log(total) // 2
```

#### update
```javascript
const ip = await db.update('ips', { hits: 1 }, 'addr = ?', req.ip)
console.log(ip) // { fieldCount: 0, affectedRows: 1, insertId: 0, changedRows: 1, ... }

const ip = await db.update('ips', [{ hits: 'hits + ?' }, 1], 'addr = ?', req.ip)
console.log(ip) // { fieldCount: 0, affectedRows: 1, insertId: 0, changedRows: 1, ... }
```

#### delete
```javascript
const ip = await db.delete('ips', 'addr = ?', req.ip)
console.log(ip) // { fieldCount: 0, affectedRows: 1, insertId: 0, ... }
```

#### transaction
Normally with a pool you do something like:
- `conn = pool.getConnection()`
- `conn.beginTransaction()`
- `conn.execute('INSERT INTO users (id, password) VALUES (?, ?)')`
- `conn.execute('INSERT INTO profile (id, name) VALUES (?, ?)')`
- `conn.commit()`
- `conn.release()`

Also checking different catchs to release and/or rollback.

This method simplifies all that and you just do the important part:
```javascript
await db.transaction(async function (conn) {
  const user = await conn.insert('users', { username: 'lukks', password: 'hwy123' })
  await conn.insert('profiles', { owner: user.insertId, name: 'Lucas' })
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

## Tests
Start a database instance
```
docker run --rm -p 3306:3306 -e MYSQL_ROOT_USER=root -e MYSQL_ROOT_PASSWORD=secret -d mysql:8.0
```

Wait a few seconds for instance creation and run tests
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
