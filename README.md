# like-mysql

Simple and intuitive ORM for MySQL

![](https://img.shields.io/npm/v/like-mysql.svg) [![](https://img.shields.io/maintenance/yes/2019.svg?style=flat-square)](https://github.com/LuKks/like-mysql) ![](https://img.shields.io/github/size/lukks/like-mysql/index.js.svg) ![](https://img.shields.io/npm/dt/like-mysql.svg) ![](https://img.shields.io/badge/tested_with-tap-e683ff.svg) ![](https://img.shields.io/github/license/LuKks/like-mysql.svg)

```javascript
const mysql = require('like-mysql');
const db = mysql.createPool({ /*config*/ });

// wait until a connection is established
db.waitConnection();

// INSERT INTO ip (addr, hits) VALUES (?, ?)
db.insert('ip', { addr: req.ip, hits: 0 });

// SELECT addr, hits FROM ip WHERE addr = ?
db.select('ip', ['addr', 'hits'], 'addr = ?', req.ip);

// SELECT addr, hits FROM ip WHERE addr = ? LIMIT 1
db.selectOne('ip', ['addr', 'hits'], 'addr = ?', req.ip);

// SELECT EXISTS(SELECT 1 FROM ip WHERE addr = ? LIMIT 1)
db.exists('ip', 'addr = ?', req.ip);

// SELECT COUNT(1) FROM ip WHERE addr = ?
db.count('ip', 'addr = ?', req.ip);

// UPDATE ip SET hits = ? WHERE addr = ?
db.update('ip', { hits: 1 }, 'addr = ?', req.ip);

// UPDATE ip SET hits = hits + ? WHERE userid = ?
db.update('ip', [{ hits: 'hits + ?' }, 1], 'addr = ?', req.ip);

// DELETE FROM ip WHERE addr = ?
db.delete('ip', 'addr = ?', req.ip);

// getConnection, beginTransaction, callback, commit/rollback, release
db.transaction(async function (conn) {
  await conn.insert('users', { id: 'lukks', password: 'hwy' });
  await conn.insert('profile', { id: 'lukks', name: 'Lucas' });
});
```

## Install
```
npm i like-mysql
```

## Features
#### MySQL
[sidorares/node-mysql2](https://github.com/sidorares/node-mysql2) as client, it's already well documented.\
Operations are prepared statements made by `execute`.\
Promise version. All custom methods are also promised.

#### Properties
After every execution the next variables are overwritten for immediate usage:
```javascript
// only on select, selectOne, exists or count:
db.rows: Array
db.fields: Array
// only on insert, update or delete:
db.insertId: Number
db.fieldCount: Number
db.affectedRows: Number
// only on update:
db.changedRows: Number
```

#### Methods
```javascript
db.insert(table: String, data: Object): Object
db.select(table: String, cols: Array, find?: String, ...any): Array
db.selectOne(table: String, cols: Array, find?: String, ...any): Object | undefined
db.exists(table: String, find?: String, ...any): Boolean
db.count (table: String, find?: String, ...any): Number
db.update(table: String, data: Object, find?: String, ...any): Object
db.update(table: String, data: Array[Object, ...any], find?: String, ...any): Object
db.delete(table: String, find?: String, ...any): Object
db.transaction(callback: Function): undefined
db.waitConnection(retry = 5: Number, time = 500: Number): undefined
```

`transaction` and `waitConnection` methods only available on pool instances.

Automatic `WHERE` when `find` argument doesn't start with:\
`ORDER BY`, `LIMIT` or `GROUP BY`

You still can use all other [node-mysql2](https://github.com/sidorares/node-mysql2) methods like `execute`, `query`, etc.

## Examples
#### insert
```javascript
// INSERT INTO ip (addr, hits) VALUES (?, ?)
let a = await db.insert('ip', { addr: req.ip, hits: 0 });
console.log(db.insertId); // 1336

let b = await db.insert('ip', { addr: req.ip, hits: 0 });
console.log(db.insertId); // 1337

console.log(a); // { fieldCount: 0, affectedRows: 1, insertId: 1336, ... }
console.log(b); // { fieldCount: 0, affectedRows: 1, insertId: 1337, ... }
```

#### select
```javascript
// SELECT addr, hits FROM ip ORDER BY hits DESC
let a = await db.select('ip', ['addr', 'hits'], 'ORDER BY hits DESC');
console.log(db.rows); // [{ addr: '8.8.8.8', hits: 6 }, ...]

// SELECT addr, hits FROM ip WHERE addr = ?
let b = await db.select('ip', ['addr', 'hits'], 'addr = ?', req.ip);
console.log(db.rows); // [{ addr: '8.8.4.4', hits: 2 }]

console.log(a); // [{ addr: '8.8.8.8', hits: 6 }, ...]
console.log(b); // [{ addr: '8.8.4.4', hits: 2 }]
```

#### selectOne
```javascript
// SELECT addr, hits FROM ip WHERE addr = ? LIMIT 1
let a = await db.selectOne('ip', ['addr', 'hits'], 'addr = ?', req.ip);
console.log(db.rows); // [{ addr: '8.8.4.4', hits: 2 }]

// SELECT addr, hits FROM ip WHERE addr = ? LIMIT 1
let b = await db.selectOne('ip', ['addr', 'hits'], 'addr = ?', '0.0.0.0');
console.log(db.rows); // []

console.log(a); // { addr: '8.8.4.4', hits: 2 }
console.log(b); // undefined
```

#### exists
```javascript
// SELECT EXISTS(SELECT 1 FROM ip WHERE addr = ? LIMIT 1)
let a = await db.exists('ip', 'addr = ?', req.ip);
console.log(a); // true
```

#### count
```javascript
// SELECT COUNT(1) FROM ip WHERE addr = ?
let a = await db.count('ip', 'addr = ?', req.ip);
console.log(a); // 2
```

#### update
```javascript
// UPDATE ip SET hits = ? WHERE addr = ?
let a = await db.update('ip', { hits: 1 }, 'addr = ?', req.ip);
console.log(db.affectedRows); // 1

// UPDATE ip SET hits = hits + ? WHERE userid = ?
let b = await db.update('ip', [{ hits: 'hits + ?' }, 1], 'addr = ?', req.ip);
console.log(db.affectedRows); // 1

console.log(a); // { fieldCount: 0, affectedRows: 1, insertId: 0, changedRows: 1, ... }
console.log(b); // { fieldCount: 0, affectedRows: 1, insertId: 0, changedRows: 1, ... }
```

#### delete
```javascript
// DELETE FROM ip WHERE addr = ?
let a = await db.delete('ip', 'addr = ?', req.ip);
console.log(db.affectedRows); // 1
console.log(a); // { fieldCount: 0, affectedRows: 1, insertId: 0, ... }
```

#### transaction
Normally with a pool you do something like:
- `conn = pool.getConnection`
- `conn.beginTransaction`
- `conn.execute 'INSERT INTO users (id, password) VALUES (?, ?)'`
- `conn.execute 'INSERT INTO profile (id, name) VALUES (?, ?)'`
- `conn.commit`
- `conn.release`

Also checking different catchs to release and/or rollback.

This method simplifies all that and you just do the important part:
```javascript
await db.transaction(async function (conn) {
  await conn.insert('users', { id: 'lukks', password: 'hwy' });
  await conn.insert('profile', { id: 'lukks', name: 'Lucas' });
});
```

The callback has the connection as context, so can avoid the first argument:
```javascript
await db.transaction(async function () {
  await this.insert(...);
  await this.insert(...);
});
```

#### waitConnection
Very useful to wait the database connection started by docker-compose.
```javascript
db.waitConnection().then(main);

async function main () {
  // ...
  await db.query(...);
  // ...
}
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
