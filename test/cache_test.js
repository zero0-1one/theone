'use strict'

const assert = require('chai').assert
const Cache = require('../lib/cache')
const toUtil = require('../lib/util')
const { its_par } = require('zo-mocha-ext')


const options = {
  'dir': './test/test_cache/cache/',
  'Adapter': require('../lib/cacheAdapter/file'),
  'timeout': 1
}

describe('cache', function () {
  let cache = Cache.createWrap(new Cache(options))
  it('set and get', async function () {
    let a = await cache.get('a')
    assert.isUndefined(a)
    a = await cache.set('a', { a: 11, b: [1, 2, 3] })
    assert.deepEqual(a, { a: 11, b: [1, 2, 3] })
    assert.deepEqual(await cache.get('a'), { a: 11, b: [1, 2, 3] })
  })

  it('timeout', async function () {
    await cache.set('a', 'aaaa')
    await cache.set('b', 'bbbb', 5)
    assert.equal(await cache.get('a'), 'aaaa')
    assert.equal(await cache.get('b'), 'bbbb')
    await toUtil.sleep(1200)
    assert.isUndefined(await cache.get('a'))
    assert.equal(await cache.get('b'), 'bbbb')
  })

  it('clear', async function () {
    await cache.set('a', 'aaaa')
    assert.equal(await cache.get('a'), 'aaaa')
    await cache.clear('a')
    assert.isUndefined(await cache.get('a'))
  })

  let num
  its_par(100, 'remember', async function () {
    await this.beforeAll(async () => {
      num = 0
      await cache.clear('a')
    })
    let a = await cache.remember('a', async function () {
      await toUtil.sleep(5)
      return ++num
    }, 100)
    assert.equal(a, 1)
    assert.equal(await cache.get('a'), a)
  })

  it('cache:set and get', async function () {
    await cache.clear('a')
    let a = await cache('a')
    assert.isUndefined(a)
    a = await cache('a', { a: 11, b: [1, 2, 3] })
    assert.deepEqual(a, { a: 11, b: [1, 2, 3] })
    assert.deepEqual(await cache('a'), { a: 11, b: [1, 2, 3] })
  })

  its_par(100, 'cache:remember', async function () {
    await this.beforeAll(async () => {
      num = 0
      await cache.clear('a')
    })
    let a = await cache('a', async function () {
      await toUtil.sleep(10)
      return ++num
    })
    assert.equal(a, 1)
    assert.equal(await cache('a'), a)
  })

  it('cache:clear', async function () {
    await cache('a', 'aaaa')
    assert.equal(await cache('a'), 'aaaa')
    cache('a', null)
    assert.isUndefined(await cache('a'))
  })

  it('clearTag', async function () {
    await cache.tag('A')('a', 'aaaa')
    await cache.tag('B')('a', 'bbbb')
    assert.equal(await cache.tag('A')('a'), 'aaaa')
    assert.equal(await cache.tag('B')('a'), 'bbbb')
    await cache.clearTag('A')
    assert.isUndefined(await cache.tag('A')('a'))
    assert.equal(await cache.tag('B')('a'), 'bbbb')
  })

  it('close', async function () {
    cache.close()
  })
})




describe('cache tag', function () {
  let tagA = Cache.createWrap(new Cache(options), 'A')
  let tagB = Cache.createWrap(new Cache(options)).tag('B')
  it('set and get', async function () {
    let a = await tagA.get('a')
    assert.isUndefined(a)
    a = await tagA.set('a', { a: 11, b: [1, 2, 3] })
    assert.deepEqual(a, { a: 11, b: [1, 2, 3] })
    assert.deepEqual(await tagA.get('a'), { a: 11, b: [1, 2, 3] })
  })

  it('timeout', async function () {
    await tagA.set('a', 'aaaa')
    await tagA.set('b', 'bbbb', 5)
    assert.equal(await tagA.get('a'), 'aaaa')
    assert.equal(await tagA.get('b'), 'bbbb')
    await toUtil.sleep(1200)
    assert.isUndefined(await tagA.get('a'))
    assert.equal(await tagA.get('b'), 'bbbb')
  })

  it('clear', async function () {
    await tagA.set('a', 'aaaa')
    assert.equal(await tagA.get('a'), 'aaaa')
    await tagA.clear('a')
    assert.isUndefined(await tagA.get('a'))
  })

  let num
  its_par(100, 'remember', async function () {
    await this.beforeAll(async () => {
      num = 0
      await tagA.clear('a')
    })
    let a = await tagA.remember('a', async function () {
      await toUtil.sleep(5)
      return ++num
    }, 100)
    assert.equal(a, 1)
    assert.equal(await tagA.get('a'), a)
  })

  it('cache:set and get', async function () {
    await tagA.clear('a')
    let a = await tagA('a')
    assert.isUndefined(a)
    a = await tagA('a', { a: 11, b: [1, 2, 3] })
    assert.deepEqual(a, { a: 11, b: [1, 2, 3] })
    assert.deepEqual(await tagA('a'), { a: 11, b: [1, 2, 3] })
  })

  its_par(100, 'cache:remember', async function () {
    await this.beforeAll(async () => {
      num = 0
      await tagA.clear('a')
    })
    let a = await tagA('a', async function () {
      await toUtil.sleep(10)
      return ++num
    })
    assert.equal(a, 1)
    assert.equal(await tagA('a'), a)
  })

  it('cache:clear', async function () {
    await tagA('a', 'aaaa')
    assert.equal(await tagA('a'), 'aaaa')
    tagA('a', null)
    assert.isUndefined(await tagA('a'))
  })

  it('clearTag', async function () {
    await tagA('a', 'aaaa')
    await tagB('a', 'bbbb')
    assert.equal(await tagA('a'), 'aaaa')
    assert.equal(await tagB('a'), 'bbbb')
    await tagA.clearTag()
    assert.isUndefined(await tagA('a'))
    assert.equal(await tagB('a'), 'bbbb')
  })

  it('close', async function () {
    tagA.close()
  })
})