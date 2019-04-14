'use strict'

const assert = require('chai').assert
const cache = require('../lib/cache')
const toUtil = require('../lib/util')
const { its_par } = require('zo-mocha-ext')


const options = {
  'dir': './test/test_cache/',
  'timeout': 1,
  'gcInterval': 2
}

describe('cache', function() {
  it('init', async function() {
    cache.init(options)
  })

  it('set and get', async function() {
    let a = await cache.get('a')
    assert.isUndefined(a)
    a = await cache.set('a', { a: 11, b: [1, 2, 3] })
    assert.deepEqual(a, { a: 11, b: [1, 2, 3] })
    assert.deepEqual(await cache.get('a'), { a: 11, b: [1, 2, 3] })
  })

  it('timeout', async function() {
    await cache.set('a', 'aaaa')
    await cache.set('b', 'bbbb', 2)
    assert.equal(await cache.get('a'), 'aaaa')
    assert.equal(await cache.get('b'), 'bbbb')
    await toUtil.sleep(1100)
    assert.isUndefined(await cache.get('a'))
    assert.equal(await cache.get('b'), 'bbbb')
  })

  it('clear', async function() {
    await cache.set('a', 'aaaa')
    assert.equal(await cache.get('a'), 'aaaa')
    await cache.clear('a')
    assert.isUndefined(await cache.get('a'))
  })

  let num
  its_par(100, 'rememver', async function() {
    await this.beforeAll(async () => {
      num = 0
      await cache.clear('a')
    })
    let a = await cache.rememver('a', async function() {
      await toUtil.sleep(10)
      return ++num
    })
    assert.equal(a, 1)
    assert.equal(await cache.get('a'), a)
  })

  it('cache:set and get', async function() {
    await cache.clear('a')
    let a = await cache('a')
    assert.isUndefined(a)
    a = await cache('a', { a: 11, b: [1, 2, 3] })
    assert.deepEqual(a, { a: 11, b: [1, 2, 3] })
    assert.deepEqual(await cache('a'), { a: 11, b: [1, 2, 3] })
  })

  its_par(100, 'cache:rememver', async function() {
    await this.beforeAll(async () => {
      num = 0
      await cache.clear('a')
    })
    let a = await cache('a', async function() {
      await toUtil.sleep(10)
      return ++num
    })
    assert.equal(a, 1)
    assert.equal(await cache('a'), a)
  })

  it('cache:clear', async function() {
    await cache('a', 'aaaa')
    assert.equal(await cache('a'), 'aaaa')
    cache('a', null)
    assert.isUndefined(await cache('a'))
  })

  it('close', async function() {
    cache.close()
  })
})