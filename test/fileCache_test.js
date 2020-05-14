'use strict'

const FileCache = require('../lib/cacheAdapter/file')
const { assert } = require('chai')
const fs = require('fs')
const path = require('path')

let options = {
  'dir': path.join(__dirname, 'test_cache/fileCache'),
}
let cache = new FileCache(options)

function isExpired(data) {
  return data.expired
}

describe('fileCache', function () {
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
    assert.isTrue(fs.existsSync(path.join(options.dir, '_tags_', 'tagA')))
    assert.isTrue(fs.existsSync(path.join(options.dir, '_tags_', 'tagB')))
    await cache.gc(isExpired) //第二次清理 空文件夹
    assert.isTrue(fs.existsSync(path.join(options.dir, '_tags_', 'tagA')))
    assert.isFalse(fs.existsSync(path.join(options.dir, '_tags_', 'tagB')))
    let noTag = await cache.get('name')
    let tagA = await cache.get('name', 'tagA')
    let tagB = await cache.get('name', 'tagB')
    assert.deepEqual(noTag, { expired: false, data: 'no tag' })
    assert.deepEqual(tagA, { expired: false, data: 'tagA' })
    assert.isUndefined(tagB)
  })

  it('gc part', async function () {
    await cache.set('name', { expired: false, data: 'no tag' })
    await cache.set('name', { expired: false, data: 'partTagA' }, 'partTagA')
    await cache.set('name', { expired: true, data: 'partTagB' }, 'partTagB')
    await cache.set('name2', { expired: true, data: 'partTagB' }, 'partTagB')
    await cache.set('name3', { expired: true, data: 'partTagB' }, 'partTagB')
    await cache.set('name4', { expired: true, data: 'partTagB' }, 'partTagB')
    await cache.set('name5', { expired: true, data: 'partTagB' }, 'partTagB')
    await cache.set('name6', { expired: true, data: 'partTagB' }, 'partTagB')
    await cache.gc(isExpired, [0, 2])
    assert.isTrue(fs.existsSync(path.join(options.dir, '_tags_', 'partTagA')))
    assert.isTrue(fs.existsSync(path.join(options.dir, '_tags_', 'partTagB')))
    await cache.gc(isExpired, [1, 2])
    await cache.gc(isExpired, [1, 2]) //第二次清理 空文件夹
    assert.isTrue(fs.existsSync(path.join(options.dir, '_tags_', 'partTagA')))
    assert.isFalse(fs.existsSync(path.join(options.dir, '_tags_', 'partTagB')))
    let noTag = await cache.get('name')
    let tagA = await cache.get('name', 'partTagA')
    let tagB = await cache.get('name', 'partTagB')
    assert.deepEqual(noTag, { expired: false, data: 'no tag' })
    assert.deepEqual(tagA, { expired: false, data: 'partTagA' })
    assert.isUndefined(tagB)
  })
})
