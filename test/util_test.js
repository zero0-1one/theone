'use strict'

const assert = require('chai').assert
const toUtil = require('../lib/util')


describe('util', function() {
  it('lock', async function() {
    let tasks = []
    tasks.push(toUtil.lock('a', async () => {
      await toUtil.sleep(1000)
    }))
    tasks.push(toUtil.lock('a', async () => {
      await toUtil.sleep(1000)
    }))
    await Promise.all(tasks)
  })


  it('passwordHash, passwordVerify', function() {
    let hash = toUtil.passwordHash('123456')
    assert.isTrue(toUtil.passwordVerify('123456', hash))
    assert.isFalse(toUtil.passwordVerify('a123456', hash))

    hash = toUtil.passwordHash('123456', 'md5')
    assert.isTrue(toUtil.passwordVerify('123456', hash))
    assert.isFalse(toUtil.passwordVerify('a123456', hash))
  })
})