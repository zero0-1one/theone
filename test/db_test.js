'use strict'

const assert = require('chai').assert
const Db = require('../lib/db')
const { its, its_par } = require('zo-mocha-ext')

const options = {
  'name': 'db',
  'host': 'localhost',
  'user': 'theone_tester',
  'password': '12345',
  'database': 'theone_test',
  'connectionLimit': 5
}

async function safeCall(todo) {
  let db = new Db(options)
  try {
    await todo(db)
  } finally {
    db.release()
  }
}

async function clearTable() {
  await safeCall(async db => {
    await db.execute('DELETE FROM test_table')
  })
}

const N = 200
describe('db', function() {
  it('name', async function() {
    await safeCall(async db => {
      assert.equal(db.name, 'db')
    })
  })

  its(N, 'database', async function() {
    await safeCall(db => {
      assert.equal(db.database, 'theone_test')
    })
  })

  its_par(N, 'query and queryOne', async function() {
    let iter = this.iteration
    await this.beforeAll(clearTable)
    await safeCall(async db => {
      let id1 = (await db.query('INSERT INTO test_table VALUES(null,?,?)', ['a', iter])).insertId
      let id2 = (await db.query('INSERT INTO test_table VALUES(null,?,?)', ['b', iter])).insertId
      assert.isBelow(id1, id2)

      let rt = await db.query('SELECT * FROM test_table WHERE v=? ORDER BY id', iter)
      assert.deepEqual(rt, [
        { id: id1, k: 'a', v: iter },
        { id: id2, k: 'b', v: iter },
      ])
      await db.query('DELETE FROM test_table WHERE k=? and v=?', ['a', iter])
      await db.query('UPDATE test_table SET k=CONCAT("u",k) WHERE v=?', iter)

      rt = await db.query('SELECT * FROM test_table WHERE v=? ORDER BY id', iter)
      assert.deepEqual(rt, [
        { id: id2, k: 'ub', v: iter }
      ])
    })
    await this.afterAll(async () => {
      await safeCall(async db => {
        let rt = await db.queryOne('SELECT COUNT(*) n FROM test_table')
        assert.equal(rt.n, N)
      })
    })
  })

  its_par(N, 'execute and executeOne', async function() {
    let iter = this.iteration
    await this.beforeAll(clearTable)
    await safeCall(async db => {
      let id1 = (await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['a', iter])).insertId
      let id2 = (await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['b', iter])).insertId
      assert.isBelow(id1, id2)

      let rt = await db.execute('SELECT * FROM test_table WHERE v=? ORDER BY id', iter)
      assert.deepEqual(rt, [
        { id: id1, k: 'a', v: iter },
        { id: id2, k: 'b', v: iter },
      ])
      await db.execute('DELETE FROM test_table WHERE k=? and v=?', ['a', iter])
      await db.execute('UPDATE test_table SET k=CONCAT("u",k) WHERE v=?', iter)
      rt = await db.execute('SELECT * FROM test_table WHERE v=? ORDER BY id', iter)
      assert.deepEqual(rt, [
        { id: id2, k: 'ub', v: iter }
      ])
    })
    await this.afterAll(async () => {
      await safeCall(async db => {
        let rt = await db.executeOne('SELECT COUNT(*) n FROM test_table')
        assert.equal(rt.n, N)
      })
    })
  })

  its_par(N, 'transaction', async function() {
    let iter = this.iteration
    await this.beforeAll(clearTable)
    await safeCall(async db => {

      let id1 = (await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['a', iter])).insertId
      await db.beginTransaction()
      await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['r', iter])
      await db.rollback()


      let rt = await db.execute('SELECT * FROM test_table WHERE v=? ORDER BY id', iter)
      assert.deepEqual(rt, [
        { id: id1, k: 'a', v: iter },
      ])

      await db.beginTransaction()
      await db.execute('DELETE FROM test_table WHERE k=? and v=?', ['a', iter])
      let id2 = (await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['b', iter])).insertId
      await db.commit()
      rt = await db.execute('SELECT * FROM test_table WHERE v=? ORDER BY id', iter)
      assert.deepEqual(rt, [
        { id: id2, k: 'b', v: iter }
      ])

      //添加 n1, n2 不提交也不关闭,测试release 后事务会不会返回池内再分配给其他使用
      await db.beginTransaction()
      await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['n1', iter])
      await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['n2', iter])
    })
    await this.afterAll(async () => {
      await safeCall(async db => {
        let rt = await db.executeOne('SELECT COUNT(*) n FROM test_table')
        assert.equal(rt.n, N)
      })
    })
  })

  it('batchInsert', async function() {
    await clearTable()
    await safeCall(async db => {
      let data1 = []
      let data2 = []
      let COUNT = 5000
      for (let i = 0; i < COUNT; i++) {
        data1.push([null,'number', i])
        data2.push(['array', i])
      }
      await db.batchInsert('test_table', 3, data1)
      await db.batchInsert('test_table', ['k', 'v'], data2)
      let rt = await db.executeOne('SELECT COUNT(*) n FROM test_table WHERE k = ?', 'number')
      assert.equal(rt.n, COUNT)
      rt = await db.executeOne('SELECT COUNT(*) n FROM test_table WHERE k = ?', 'array')
      assert.equal(rt.n, COUNT)
    })
  })
  //不close 测试用例不会退出 istanbul/nyc 也就无法统计覆盖了
  // it('close', async function() {
  //   await Db.close()
  // })
})