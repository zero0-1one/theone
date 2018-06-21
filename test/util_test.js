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
})