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
  let cache = Cache.createWrap(new Cache(options, 0))
  let cacheV2 = Cache.createWrap(new Cache(options, 2))
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
    let a = await cache.remember(
      'a',
      async function () {
        await toUtil.sleep(5)
        return ++num
      },
      100
    )
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

  it('cache:clearTag', async function () {
    await cache.tag('A')('a', 'aaaa')
    await cache.tag('B')('a', 'bbbb')
    assert.equal(await cache.tag('A')('a'), 'aaaa')
    assert.equal(await cache.tag('B')('a'), 'bbbb')
    await cache.clearTag('A')
    assert.isUndefined(await cache.tag('A')('a'))
    assert.equal(await cache.tag('B')('a'), 'bbbb')
  })

  it('version', async function () {
    await cache.set('a', 'aaaa')
    assert.equal(await cache.get('a'), 'aaaa')
    assert.isUndefined(await cacheV2.get('a'))

    await cache.tag('A')('a', 'aaaa')
    assert.equal(await cache.tag('A')('a'), 'aaaa')
    assert.isUndefined(await cacheV2.tag('A')('a'))
  })

  it('close', async function () {
    cache.close()
  })
})

describe('cache tag', function () {
  let tagA = Cache.createWrap(new Cache(options, 3), 'A')
  let tagB = Cache.createWrap(new Cache(options, 4)).tag('B')
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
    let a = await tagA.remember(
      'a',
      async function () {
        await toUtil.sleep(5)
        return ++num
      },
      100
    )
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

describe('cache colon tag', function () {
  let cacheA = Cache.createWrap(new Cache(options, 5))
  let cacheB = Cache.createWrap(new Cache(options, 6))
  let tagA = Cache.createWrap(new Cache(options, 5), 'A')
  let tagB = Cache.createWrap(new Cache(options, 6)).tag('B')
  it('set and get', async function () {
    let a = await cacheA.get('A:a')
    assert.deepEqual(a, await tagA.get('a'))
    assert.isUndefined(a)
    a = await cacheA.set('A:a', { a: 11, b: [1, 2, 3] })
    assert.deepEqual(a, await tagA.get('a'))
    assert.deepEqual(a, { a: 11, b: [1, 2, 3] })
    assert.deepEqual(await cacheA.get('A:a'), { a: 11, b: [1, 2, 3] })
  })

  it('timeout', async function () {
    await cacheA.set('A:a', 'aaaa')
    await cacheA.set('A:b', 'bbbb', 5)
    assert.equal(await cacheA.get('A:a'), 'aaaa')
    assert.equal(await cacheA.get('A:b'), 'bbbb')
    await toUtil.sleep(1200)
    assert.isUndefined(await cacheA.get('A:a'))
    assert.isUndefined(await tagA.get('a'))
    assert.equal(await cacheA.get('A:b'), 'bbbb')
    assert.equal(await tagA.get('b'), 'bbbb')
  })

  it('clear', async function () {
    await cacheA.set('A:a', 'aaaa')
    assert.equal(await cacheA.get('A:a'), 'aaaa')
    assert.equal(await tagA.get('a'), 'aaaa')
    await cacheA.clear('A:a')
    assert.isUndefined(await cacheA.get('A:a'))
    assert.isUndefined(await tagA.get('a'))
  })

  let num
  its_par(100, 'remember', async function () {
    await this.beforeAll(async () => {
      num = 0
      await cacheA.clear('A:a')
    })
    let a = await cacheA.remember(
      'A:a',
      async function () {
        await toUtil.sleep(5)
        return ++num
      },
      100
    )
    assert.equal(a, 1)
    assert.equal(await cacheA.get('A:a'), a)
  })

  it('cache:set and get', async function () {
    await cacheA.clear('A:a')
    let a = await cacheA('A:a')
    assert.isUndefined(a)
    a = await cacheA('A:a', { a: 11, b: [1, 2, 3] })
    assert.deepEqual(a, { a: 11, b: [1, 2, 3] })
    assert.deepEqual(await cacheA('A:a'), { a: 11, b: [1, 2, 3] })
  })

  its_par(100, 'cache:remember', async function () {
    await this.beforeAll(async () => {
      num = 0
      await cacheA.clear('A:a')
    })
    let a = await cacheA('A:a', async function () {
      await toUtil.sleep(10)
      return ++num
    })
    assert.equal(a, 1)
    assert.equal(await cacheA('A:a'), a)
  })

  it('cache:clear', async function () {
    await cacheA('A:a', 'aaaa')
    assert.equal(await cacheA('A:a'), 'aaaa')
    cacheA('A:a', null)
    assert.isUndefined(await cacheA('A:a'))
  })

  it('clearTag', async function () {
    await cacheA('A:a', 'aaaa')
    await cacheB('B:a', 'bbbb')
    assert.equal(await cacheA('A:a'), 'aaaa')
    assert.equal(await cacheB('B:a'), 'bbbb')
    await cacheA.clearTag('A')
    assert.isUndefined(await cacheA('A:a'))
    assert.equal(await cacheB('B:a'), 'bbbb')

    assert.isUndefined(await tagA('a'))
    assert.equal(await tagB('a'), 'bbbb')
  })

  it('close', async function () {
    cacheA.close()
  })
})
