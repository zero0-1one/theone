'use strict'

const MemoryCache = require('../lib/cacheAdapter/memory')
const { assert } = require('chai')

let cache = new MemoryCache()

function isExpired(data) {
  return data.expired
}

describe('memoryCache', function () {
  it('set', async function () {
    await cache.set('name', { expired: false, data: 'no tag' })
    await cache.set('name', { expired: false, data: 'tagA' }, 'tagA')
    await cache.set('name', { expired: true, data: 'tagB' }, 'tagB')
  })

  it('get', async function () {
    let noTag = await cache.get('name')
    let tagA = await cache.get('name', 'tagA')
    let tagB = await cache.get('name', 'tagB')
    assert.deepEqual(noTag, { expired: false, data: 'no tag' })
    assert.deepEqual(tagA, { expired: false, data: 'tagA' })
    assert.deepEqual(tagB, { expired: true, data: 'tagB' })
  })

  it('clear', async function () {
    await cache.clear('name')
    await cache.clear('name', 'tagA')
    await cache.clear('name', 'tagB')
    let noTag = await cache.get('name')
    let tagA = await cache.get('name', 'tagA')
    let tagB = await cache.get('name', 'tagB')
    assert.isUndefined(noTag)
    assert.isUndefined(tagA)
    assert.isUndefined(tagB)
  })

  it('clearTag', async function () {
    await cache.set('a1', 'a', 'tagA')
    await cache.set('b1', 'b', 'tagB')
    await cache.set('b2', 'c', 'tagB')
    await cache.set('b3', 'd', 'tagB')
    await cache.clearTag('tagB')

    assert.equal(await cache.get('a1', 'tagA'), 'a')
    assert.isUndefined(await cache.get('b1', 'tagB'), 'b')
    assert.isUndefined(await cache.get('b2', 'tagB'), 'c')
    assert.isUndefined(await cache.get('b3', 'tagB'), 'd')
  })

  it('gc', async function () {
    await cache.set('name', { expired: false, data: 'no tag' })
    await cache.set('name', { expired: false, data: 'tagA' }, 'tagA')
    await cache.set('name', { expired: true, data: 'tagB' }, 'tagB')
    await cache.gc(isExpired)

    let noTag = await cache.get('name')
    let tagA = await cache.get('name', 'tagA')
    let tagB = await cache.get('name', 'tagB')
    assert.deepEqual(noTag, { expired: false, data: 'no tag' })
    assert.deepEqual(tagA, { expired: false, data: 'tagA' })
    assert.isUndefined(tagB)
  })
})
