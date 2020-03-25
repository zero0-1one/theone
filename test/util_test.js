'use strict'

const assert = require('chai').assert
const toUtil = require('../lib/util')

describe('util', function () {
  it('deepAssign', async function () {
    let a = {
      b: {
        c: [1, 2, { d: 3 }],
        e: 'e1'
      },
      c: 1
    }

    let b = {
      'b.c.1': 5,
      'b.c.2.d': 6,
      b: {
        e: 'e2'
      },
      f: [1, 2]
    }

    toUtil.deepAssign(a, b)
    assert.deepEqual(a, {
      b: {
        c: [1, 5, { d: 6 }],
        e: 'e2'
      },
      c: 1,
      f: [1, 2]
    })
  })


  it('doOrder', async function () {
    let tasks = []
    let owner = {}
    let results = []
    tasks.push(
      toUtil.doOrder('a', owner, async () => {
        results.push(1)
        await toUtil.sleep(1000)
        results.push(2)
      })
    )
    tasks.push(
      toUtil.doOrder('a', owner, async () => {
        results.push(3)
        await toUtil.sleep(1000)
        results.push(4)
      })
    )
    await Promise.all(tasks)
    assert.deepEqual(results, [1, 2, 3, 4])
  })

  it('passwordHash, passwordVerify', function () {
    let hash = toUtil.passwordHash('123456')
    assert.isTrue(toUtil.passwordVerify('123456', hash))
    assert.isFalse(toUtil.passwordVerify('a123456', hash))

    hash = toUtil.passwordHash('123456', 'md5')
    assert.isTrue(toUtil.passwordVerify('123456', hash))
    assert.isFalse(toUtil.passwordVerify('a123456', hash))
  })
})
