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
  'connectionLimit': 20,
  'queueLimit': 0,
  'waitForConnections': true,
}

async function safeCall(cb, opts = options, mustInTrans = false) {
  opts = JSON.parse(JSON.stringify(opts))
  opts['mustInTrans'] = mustInTrans
  return Db.safeCall(cb, opts)
}

async function clearTable() {
  await safeCall(async db => {
    await db.execute('DELETE FROM test_table')
  })
}

const N = 200
describe('db', function () {
  it('name', async function () {
    await safeCall(async db => {
      assert.equal(db.name, 'db')
    })
  })

  its(N, 'database', async function () {
    await safeCall(db => {
      assert.equal(db.database, 'theone_test')
    })
  })

  it('mustInTrans', async function () {
    await safeCall(
      async db => {
        let isThrow = false
        try {
          await db.query('SELECT COUNT(*) FROM test_table')
        } catch (error) {
          isThrow = true
        }
        assert.isTrue(isThrow)
        await db.beginTransaction()
        await db.query('SELECT COUNT(*) FROM test_table')
      },
      options,
      true
    )
  })

  its_par(N, 'query and queryOne', async function () {
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
      assert.deepEqual(rt, [{ id: id2, k: 'ub', v: iter }])
    })
    await this.afterAll(async () => {
      await safeCall(async db => {
        let rt = await db.queryOne('SELECT COUNT(*) n FROM test_table')
        assert.equal(rt.n, N)
      })
    })
  })

  its_par(N, 'execute and executeOne', async function () {
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
      assert.deepEqual(rt, [{ id: id2, k: 'ub', v: iter }])
    })
    await this.afterAll(async () => {
      await safeCall(async db => {
        let rt = await db.executeOne('SELECT COUNT(*) n FROM test_table')
        assert.equal(rt.n, N)
      })
    })
  })

  its_par(N, 'execute use pattern', async function () {
    let iter = this.iteration
    await this.beforeAll(clearTable)
    await safeCall(async db => {
      await db.execute('INSERT INTO test_table VALUES {(null,?,?)},...', [['a', iter, 'b', iter, 'c', iter, 'd', iter]])
      await db.execute('INSERT INTO test_table VALUES (null,?,?), {(null,?,?)},... ,(null,?,?)', [
        'e',
        iter,
        [
          ['f', iter],
          ['g', iter],
        ],
        'h',
        iter,
      ])

      await db.execute(
        'INSERT INTO test_table VALUES {(null,?,?)},...',
        [['i', iter, 'j', iter, 'k', iter, 'l', iter]],
        { maxRow: 2 }
      )
      await db.execute(
        'INSERT INTO test_table VALUES {(null,?,?)},...',
        [
          [
            ['m', iter],
            ['n', iter],
            ['o', iter],
            ['p', iter],
          ],
        ],
        { maxRow: 3 }
      )
      await db.execute(
        'INSERT INTO test_table VALUES {(null,?,?)},...',
        [
          [
            ['r', iter],
            ['s', iter],
            ['t', iter],
            ['u', iter],
          ],
        ],
        { maxRow: 100 }
      )

      let rt = await db.execute('SELECT k, v FROM test_table WHERE v=? ORDER BY k', iter)
      assert.deepEqual(rt, [
        { k: 'a', v: iter },
        { k: 'b', v: iter },
        { k: 'c', v: iter },
        { k: 'd', v: iter },
        { k: 'e', v: iter },
        { k: 'f', v: iter },
        { k: 'g', v: iter },
        { k: 'h', v: iter },
        { k: 'i', v: iter },
        { k: 'j', v: iter },
        { k: 'k', v: iter },
        { k: 'l', v: iter },
        { k: 'm', v: iter },
        { k: 'n', v: iter },
        { k: 'o', v: iter },
        { k: 'p', v: iter },
        { k: 'r', v: iter },
        { k: 's', v: iter },
        { k: 't', v: iter },
        { k: 'u', v: iter },
      ])
    })
  })

  its_par(N, 'query use pattern', async function () {
    let iter = this.iteration
    await this.beforeAll(clearTable)
    await safeCall(async db => {
      await db.query('INSERT INTO test_table VALUES {(null,?,?)},...', [['a', iter, 'b', iter, 'c', iter, 'd', iter]])
      await db.query('INSERT INTO test_table VALUES (null,?,?), {(null,?,?)},... ,(null,?,?)', [
        'e',
        iter,
        [
          ['f', iter],
          ['g', iter],
        ],
        'h',
        iter,
      ])

      await db.query('INSERT INTO test_table VALUES {(null,?,?)},...', [['i', iter, 'j', iter, 'k', iter, 'l', iter]], {
        maxRow: 2,
      })
      await db.query(
        'INSERT INTO test_table VALUES {(null,?,?)},...',
        [
          [
            ['m', iter],
            ['n', iter],
            ['o', iter],
            ['p', iter],
          ],
        ],
        { maxRow: 3 }
      )

      await db.query(
        'INSERT INTO test_table VALUES {(null,?,?)},...',
        [
          [
            ['r', iter],
            ['s', iter],
            ['t', iter],
            ['u', iter],
          ],
        ],
        { maxRow: 100 }
      )

      let rt = await db.query('SELECT k, v FROM test_table WHERE v=? ORDER BY k', iter)
      assert.deepEqual(rt, [
        { k: 'a', v: iter },
        { k: 'b', v: iter },
        { k: 'c', v: iter },
        { k: 'd', v: iter },
        { k: 'e', v: iter },
        { k: 'f', v: iter },
        { k: 'g', v: iter },
        { k: 'h', v: iter },
        { k: 'i', v: iter },
        { k: 'j', v: iter },
        { k: 'k', v: iter },
        { k: 'l', v: iter },
        { k: 'm', v: iter },
        { k: 'n', v: iter },
        { k: 'o', v: iter },
        { k: 'p', v: iter },
        { k: 'r', v: iter },
        { k: 's', v: iter },
        { k: 't', v: iter },
        { k: 'u', v: iter },
      ])
    })
  })

  its_par(N, 'select use pattern', async function () {
    let iter = this.iteration
    await this.beforeAll(clearTable)
    await safeCall(async db => {
      await db.query(
        'INSERT INTO test_table VALUES {(null,?,?)},...',
        [['a', iter, 'b', iter, 'c', iter, 'd', iter, 'e', iter, 'f', iter]],
        { maxRow: 2 }
      )
      let rt = await db.query('SELECT k, v FROM test_table WHERE v = ? AND k IN ({?},...) ORDER BY k', [
        iter,
        ['a', 'b', 's', 'f'],
      ])
      assert.deepEqual(rt, [
        { k: 'a', v: iter },
        { k: 'b', v: iter },
        { k: 'f', v: iter },
      ])
    })
  })

  its_par(N, 'transaction', async function () {
    let iter = this.iteration
    await this.beforeAll(clearTable)
    await safeCall(async db => {
      let id1 = (await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['a', iter])).insertId
      await db.beginTransaction()
      await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['r', iter])
      await db.rollback()

      let rt = await db.execute('SELECT * FROM test_table WHERE v=? ORDER BY id', iter)
      assert.deepEqual(rt, [{ id: id1, k: 'a', v: iter }])

      await db.beginTransaction()
      await db.execute('DELETE FROM test_table WHERE k=? and v=?', ['a', iter])
      let id2 = (await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['b', iter])).insertId
      await db.commit()
      rt = await db.execute('SELECT * FROM test_table WHERE v=? ORDER BY id', iter)
      assert.deepEqual(rt, [{ id: id2, k: 'b', v: iter }])

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

  //两层safeCall 连接数不够会死锁。 这里就测试 5 次
  its_par(5, 'bind unbind', async function () {
    let iter = this.iteration
    await this.beforeAll(clearTable)
    await safeCall(async db => {
      await safeCall(async db2 => {
        let id1, id2, rt
        await db.bind(db2)
        id1 = (await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['a', iter])).insertId
        await db.beginTransaction()
        await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['r', iter])
        await db2.execute('INSERT INTO test_table VALUES(null,?,?)', ['r2', iter])
        await db.rollback()

        rt = await db.execute('SELECT * FROM test_table WHERE v=? ORDER BY id', iter)
        assert.deepEqual(rt, [{ id: id1, k: 'a', v: iter }])

        await db.beginTransaction()
        await db.execute('DELETE FROM test_table WHERE k=? and v=?', ['a', iter])
        id1 = (await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['b', iter])).insertId
        id2 = (await db2.execute('INSERT INTO test_table VALUES(null,?,?)', ['b2', iter])).insertId
        await db.commit()
        rt = await db.execute('SELECT * FROM test_table WHERE v=? ORDER BY id', iter)
        let rows = [
          { id: id1, k: 'b', v: iter },
          { id: id2, k: 'b2', v: iter },
        ]
        assert.deepEqual(rt, rows)

        await db.unbind(db2)
        await db.beginTransaction()
        await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['x', iter])

        //unbind后不再同步回滚，会添加成功
        id2 = (await db2.execute('INSERT INTO test_table VALUES(null,?,?)', ['x2', iter])).insertId
        rows.push({ id: id2, k: 'x2', v: iter })
        await db.rollback()
        rt = await db.execute('SELECT * FROM test_table WHERE v=? ORDER BY id', iter)

        assert.deepEqual(rt, rows)

        //添加 n1, n2 不提交也不关闭,测试release 后事务会不会返回池内再分配给其他使用
        await db.beginTransaction()
        assert.isFalse(db2.isBegin())
        await db.bind(db2)// bind 后绑定
        assert.isTrue(db2.isBegin())
        await db.execute('INSERT INTO test_table VALUES(null,?,?)', ['n1', iter])
        await db2.execute('INSERT INTO test_table VALUES(null,?,?)', ['n2', iter])
      })
    })
    await this.afterAll(async () => {
      await safeCall(async db => {
        let rt = await db.executeOne('SELECT COUNT(*) n FROM test_table')
        assert.equal(rt.n, 3 * 5)
      })
    })
  })

  //不close 测试用例不会退出 istanbul/nyc 也就无法统计覆盖了
  it('close', async function () {
    await Db.close()
  })
})
