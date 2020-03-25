'use strict'

const MemoryCache = require('../lib/cacheAdapter/memory')
const { assert } = require('chai')


let cache = new MemoryCache()

function isExpired(data) {
  return data.expired
}

describe('memoryCache', function () {
  it('set', function () {
    cache.set('name', { expired: false, data: 'no tag' })
    cache.set('name', { expired: false, data: 'tagA' }, 'tagA')
    cache.set('name', { expired: true, data: 'tagB' }, 'tagB')
  })

  it('get', function () {
    let noTag = cache.get('name')
    let tagA = cache.get('name', 'tagA')
    let tagB = cache.get('name', 'tagB')
    assert.deepEqual(noTag, { expired: false, data: 'no tag' })
    assert.deepEqual(tagA, { expired: false, data: 'tagA' })
    assert.deepEqual(tagB, { expired: true, data: 'tagB' })
  })

  it('clear', function () {
    cache.clear('name')
    cache.clear('name', 'tagA')
    cache.clear('name', 'tagB')
    let noTag = cache.get('name')
    let tagA = cache.get('name', 'tagA')
    let tagB = cache.get('name', 'tagB')
    assert.isUndefined(noTag)
    assert.isUndefined(tagA)
    assert.isUndefined(tagB)
  })

  it('clearTag', function () {
    cache.set('a1', 'a', 'tagA')
    cache.set('b1', 'b', 'tagB')
    cache.set('b2', 'c', 'tagB')
    cache.set('b3', 'd', 'tagB')
    cache.clearTag('tagB')

    assert.equal(cache.get('a1', 'tagA'), 'a')
    assert.isUndefined(cache.get('b1', 'tagB'), 'b')
    assert.isUndefined(cache.get('b2', 'tagB'), 'c')
    assert.isUndefined(cache.get('b3', 'tagB'), 'd')
  })

  it('gc', function () {
    cache.set('name', { expired: false, data: 'no tag' })
    cache.set('name', { expired: false, data: 'tagA' }, 'tagA')
    cache.set('name', { expired: true, data: 'tagB' }, 'tagB')
    cache.gc(isExpired)

    let noTag = cache.get('name')
    let tagA = cache.get('name', 'tagA')
    let tagB = cache.get('name', 'tagB')
    assert.deepEqual(noTag, { expired: false, data: 'no tag' })
    assert.deepEqual(tagA, { expired: false, data: 'tagA' })
    assert.isUndefined(tagB)
  })
})