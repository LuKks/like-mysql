const tape = require('tape')
const mysql = require('./')

const cfg = ['127.0.0.1:3305', 'root', 'secret', 'sys']

tape('able to connect', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  await db.end()
})

tape('end without ready', async function (t) {
  const db = new mysql(...cfg)

  await db.end()
})

tape('ready timeouts', async function (t) {
  const db = new mysql('127.0.0.1:1234', cfg[1], cfg[2], cfg[3])

  try {
    await db.ready(0)
    t.fail('ready with wrong host:port')
  } catch (error) {
    t.ok(error.code === 'ECONNREFUSED')
  }

  await db.end()
})

tape('should not connect due unexisting database', async function (t) {
  const db = new mysql(cfg[0], cfg[1], cfg[2], 'database-not-exists')

  try {
    await db.ready()
    t.fail('ready with unexisting database')
  } catch (error) {
    t.ok(error.code === 'ER_BAD_DB_ERROR')
  }

  await db.end()
})

tape('limited connections', async function (t) {
  const db = new mysql(...cfg, { connectionLimit: 1, waitForConnections: false })

  await db.ready()

  const conn = await db.getConnection()

  try {
    await db.ready()
    t.fail('ready without any connection in the pool available')
  } catch (error) {
    t.ok(error.message === 'No connections available.')
  }

  conn.release()

  await db.end()
})

tape('create and drop database', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  t.ok(await db.createDatabase('forex'))
  t.notOk(await db.createDatabase('forex'))

  t.ok(await db.dropDatabase('forex'))
  t.notOk(await db.dropDatabase('forex'))

  await db.end()
})

tape('create database without any previous database', async function (t) {
  const db = new mysql(cfg[0], cfg[1], cfg[2], '')

  await db.ready()

  t.ok(await db.createDatabase('forex'))
  t.ok(await db.dropDatabase('forex'))

  await db.end()
})

tape('create and drop table', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  const columns = {
    username: { type: 'varchar', length: 16 }
  }

  t.ok(await db.createTable('users', columns))
  t.notOk(await db.createTable('users', columns))

  t.ok(await db.dropTable('users'))
  t.notOk(await db.dropTable('users'))

  await db.end()
})

// + create complex tables

tape('insert without autoincrement id', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  await db.createTable('users', {
    id: { type: 'int', primary: true },
    username: { type: 'varchar', length: 16 }
  })

  t.ok(0 === await db.insert('users', { id: 1, username: 'joe' }))
  t.ok(0 === await db.insert('users', { id: 2, username: 'joe' }))

  await db.dropTable('users')

  await db.end()
})

tape('insert with autoincrement id', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  await db.createTable('users', {
    id: { type: 'int', increment: true, primary: true },
    username: { type: 'varchar', length: 16 }
  })

  t.ok(1 === await db.insert('users', { username: 'joe' }))
  t.ok(2 === await db.insert('users', { username: 'bob' }))

  await db.dropTable('users')

  await db.end()
})

tape('insert', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  await db.createTable('users', {
    username: { type: 'varchar', length: 16 }
  }, {
    unique: {
      user_username: ['username']
    }
  })

  await db.insert('users', { username: 'joe' })

  try {
    await db.insert('users', { username: 'joe'.repeat(10) })
    t.fail('inserted data that exceeds column length')
  } catch (error) {
    t.ok(error.code === 'ER_DATA_TOO_LONG')
  }

  try {
    await db.insert('users', { username: 'joe' })
    t.fail('inserted a duplicated entry')
  } catch (error) {
    t.ok(error.code === 'ER_DUP_ENTRY')
  }

  await db.dropTable('users')

  await db.end()
})

tape('select', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  await db.createTable('users', {
    username: { type: 'varchar', length: 16 },
    password: { type: 'varchar', length: 16 }
  })
  await db.insert('users', { username: 'joe', password: '123' })
  await db.insert('users', { username: 'bob', password: '456' })

  const rows = await db.select('users')
  t.ok(rows.length === 2)
  t.deepEqual(rows[0], { username: 'joe', password: '123' })
  t.deepEqual(rows[1], { username: 'bob', password: '456' })

  const rows2 = await db.select('users', ['username'])
  t.ok(rows2.length === 2)
  t.deepEqual(rows2[0], { username: 'joe'})
  t.deepEqual(rows2[1], { username: 'bob' })

  const rows3 = await db.select('users', ['username'], 'LIMIT 1')
  t.ok(rows3.length === 1)
  t.deepEqual(rows3[0], { username: 'joe'})

  const findUsername = 'joe'
  const rows4 = await db.select('users', ['password'], 'username = ?', findUsername)
  t.ok(rows4.length === 1)
  t.deepEqual(rows4[0], { password: '123'})

  const rows5 = await db.select('users', ['*'], 'ORDER BY username ASC')
  t.ok(rows5.length === 2)
  t.ok(rows5[0].username === 'bob')
  t.ok(rows5[1].username === 'joe')

  const rows6 = await db.select('users', ['*'], 'ORDER BY username ASC LIMIT 1')
  t.ok(rows6.length === 1)
  t.ok(rows6[0].username === 'bob')

  const rows7 = await db.select('users', ['*'], 'username = ? ORDER BY username ASC LIMIT 2', 'joe')
  t.ok(rows7.length === 1)
  t.ok(rows7[0].username === 'joe')

  const rows8 = await db.select('users', ['*'], 'username = ?', 'random-username')
  t.ok(rows8.length === 0)

  const rows9 = await db.select('users', ['*'], 'username LIKE ?', 'b%')
  t.ok(rows9.length === 1)

  await db.dropTable('users')

  await db.end()
})

tape('selectOne', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  await db.createTable('users', {
    username: { type: 'varchar', length: 16 },
    password: { type: 'varchar', length: 16 }
  })
  await db.insert('users', { username: 'joe', password: '123' })
  await db.insert('users', { username: 'bob', password: '456' })

  const row = await db.selectOne('users', ['*'], 'username = ?', 'joe')
  t.deepEqual(row, { username: 'joe', password: '123' })

  const row2 = await db.selectOne('users', ['*'], 'ORDER BY username ASC')
  t.deepEqual(row2, { username: 'bob', password: '456' })

  const row3 = await db.selectOne('users', ['*'], 'username = ? ORDER BY username ASC', 'joe')
  t.deepEqual(row3, { username: 'joe', password: '123' })

  const row4 = await db.selectOne('users', ['*'], 'username = ?', 'random-username')
  t.deepEqual(row4, undefined)

  await db.dropTable('users')

  await db.end()
})

tape('exists', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  await db.createTable('users', {
    username: { type: 'varchar', length: 16 },
    password: { type: 'varchar', length: 16 }
  })
  await db.insert('users', { username: 'joe', password: '123' })
  await db.insert('users', { username: 'bob', password: '456' })

  const exists = await db.exists('users', 'username = ?', 'joe')
  t.ok(exists)

  const exists2 = await db.exists('users', 'username = ?', 'random-username')
  t.notOk(exists2)

  await db.dropTable('users')

  await db.end()
})

tape('count', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  await db.createTable('users', {
    username: { type: 'varchar', length: 16 },
    password: { type: 'varchar', length: 16 }
  })
  await db.insert('users', { username: 'joe', password: '123' })
  await db.insert('users', { username: 'bob', password: '456' })

  const count = await db.count('users')
  t.ok(count === 2)

  const count2 = await db.count('users', 'username = ?', 'joe')
  t.ok(count2 === 1)

  const count3 = await db.count('users', 'username = ?', 'random-username')
  t.ok(count3 === 0)

  await db.dropTable('users')

  await db.end()
})

tape('update', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  await db.createTable('users', {
    username: { type: 'varchar', length: 16 },
    password: { type: 'varchar', length: 16 }
  })
  await db.insert('users', { username: 'joe', password: '123' })
  await db.insert('users', { username: 'bob', password: '456' })

  t.ok(1 === await db.update('users', { username: 'alice' }, 'username = ?', 'bob')) // 1 chg, 1 aff

  t.ok(1 === await db.update('users', { username: 'alice' })) // 1 chg, 2 aff

  t.ok(0 === await db.update('users', { username: 'alice' }, 'username = ?', 'random-username')) // 0 chg, 0 aff

  t.ok(2 === await db.update('users', { username: 'unique-username' }))
  t.ok(1 === await db.update('users', { username: 'unique-username2' }, 'LIMIT 1'))

  await db.dropTable('users')

  await db.end()
})

tape('update with arithmetic', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  await db.createTable('users', {
    username: { type: 'varchar', length: 16 },
    count: { type: 'int' }
  })
  await db.insert('users', { username: 'joe', count: 0 })
  await db.insert('users', { username: 'bob', count: 0 })

  t.deepEqual({ count: 0 }, await db.selectOne('users', ['count'], 'username = ?', 'bob'))
  t.ok(1 === await db.update('users', [{ count: 'count + ?' }, 1], 'username = ?', 'bob'))
  t.deepEqual({ count: 1 }, await db.selectOne('users', ['count'], 'username = ?', 'bob'))

  await db.dropTable('users')

  await db.end()
})

tape('delete', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  await db.createTable('users', {
    username: { type: 'varchar', length: 16 },
    count: { type: 'int' }
  })

  await db.insert('users', { username: 'joe', count: 0 })
  await db.insert('users', { username: 'bob', count: 0 })
  t.ok(2 === await db.delete('users'))
  t.ok(0 === await db.delete('users'))

  await db.insert('users', { username: 'joe', count: 0 })
  await db.insert('users', { username: 'bob', count: 0 })
  t.ok(1 === await db.delete('users', 'LIMIT 1'))
  t.ok(1 === await db.delete('users'))

  await db.insert('users', { username: 'joe', count: 0 })
  await db.insert('users', { username: 'bob', count: 0 })
  t.ok(1 === await db.delete('users', 'username = ?', 'bob'))
  t.ok(0 === await db.delete('users', 'username = ?', 'bob'))
  t.ok(1 === await db.delete('users', 'username = ?', 'joe'))

  await db.dropTable('users')

  await db.end()
})

tape('transaction', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  await db.createTable('users', {
    id: { type: 'int', increment: true, primary: true },
    username: { type: 'varchar', length: 16 }
  })
  await db.createTable('profiles', {
    id: { type: 'int', primary: true },
    name: { type: 'varchar', length: 16 }
  })
  await db.insert('users', { username: 'joe' })
  await db.insert('users', { username: 'bob' })

  const resultId = await db.transaction(async function (conn) {
    const id = await conn.insert('users', { username: 'alice' })
    await conn.insert('profiles', { owner: id, name: 'Alice' })
    return id
  })

  const user = await db.selectOne('users', ['*'], 'username = ?', 'alice')
  const profile = await db.selectOne('profiles', ['*'], 'owner = ?', user.id)
  t.ok(user.id === resultId)
  t.deepEqual(user, { id: 3, username: 'alice' })
  t.deepEqual(profile, { owner: 3, name: 'Alice' })

  await db.dropTable('users')

  await db.end()
})

tape('transaction', async function (t) {
  const db = new mysql(...cfg)

  await db.ready()

  await db.createTable('users', {
    id: { type: 'int', increment: true, primary: true },
    username: { type: 'varchar', length: 16 }
  })
  await db.insert('users', { username: 'joe' })
  await db.insert('users', { username: 'bob' })

  try {
    await db.transaction(async function (conn) {
      await conn.delete('users', 'username = ?', 'joe')
      await conn.delete('users', 'username = ?', 'bob')
      throw new Error('test error')
    })
    t.fail('transaction should have throw an error')
  } catch (error) {
    t.ok(error.message === 'test error')
    t.ok(2 === await db.count('users'))
  }

  await db.transaction(async function (conn) {
    await conn.delete('users', 'username = ?', 'joe')
    await conn.delete('users', 'username = ?', 'bob')
  })
  t.ok(0 === await db.count('users'))

  await db.dropTable('users')

  await db.end()
})

/*
await db.createTable('items', {
  id: { type: 'int', unsigned: true, required: true, increment: true, primary: true },
  fullname: { type: 'varchar', length: 64, collate: 'utf8mb4_unicode_ci', required: true },
  description: { type: 'varchar', length: 256, required: true },
  price: { type: 'decimal', length: [11, 2], required: true },
  dni: { type: 'int', unsigned: true, required: true },
  birthdate: { type: 'date', default: null },
  liq: { type: 'decimal(11,2)', required: true },
  cuit: { type: 'bigint', unsigned: true, required: true },
  posted: { type: 'tinyint', unsigned: true, required: true }
}, {
  unique: {
    person_dni: ['dni', 'fullname']
  },
  index: {
    person2: ['fullname ASC', 'dni ASC']
  },
  engine: 'InnoDB',
  increment: 95406,
  charset: 'utf8mb4',
  collate: 'utf8mb4_unicode_ci'
})
*/
