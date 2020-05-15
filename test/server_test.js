'use strict'
const Client = require('./client')
const assert = require('chai').assert

let api = new Client('v1.0.0', 'api')
let admin = new Client(null, 'admin')

describe('server test', function () {
  describe('app', function () {
    it('setErrorHandlers  parsePath', async function () {
      let isHandler = false
      theone.app.setErrorHandlers({
        parsePath: () => (isHandler = true),
      })
      await api.get('test/nodb/succeed').catch(() => {})
      assert.isFalse(isHandler)

      await api.get('error-patch').catch(() => {})
      assert.isTrue(isHandler)
    })

    it('setErrorHandlers  callAction', async function () {
      let isHandler = false
      theone.app.setErrorHandlers({
        callAction: () => (isHandler = true),
      })
      await api.get('test/nodb/paramInt', { arg: '123' })
      assert.isFalse(isHandler)
      await api.get('test/nodb/paramInt', { arg: 'asdf324' }).catch(() => {})
      assert.isTrue(isHandler)
    })
  })

  describe('controller', function () {
    it('inject after', async function () {
      let rt = await api.post('test/nodb/injectAfter', { arg: { a: 1, b: 2 } })
      assert.deepEqual(rt, { a: 1, b: 2 })
    })

    it('inject before', async function () {
      let rt = await api.post('test/nodb/injectBefore', { arg: { a: 1, b: 2 } })
      assert.deepEqual(rt, { a: 1, b: 2 })
    })

    it('inject mixed', async function () {
      let rt = await api.post('test/nodb/injectMixed', { after: { a: 1, b: 2 }, before: { e: 3, f: 'abc' } })
      assert.deepEqual(rt, { after: { a: 1, b: 2 }, before: { e: 3, f: 'abc' } })
    })

    it('cache', async function () {
      await api.post('test/nodb/setCache', { name: 'aaa', value: 123 })
      let rt = await api.get('test/nodb/getCache', { name: 'aaa' })
      assert.deepEqual(rt, { value: 123 })

      await api.post('test/nodb/setCache', { name: 'aaa', value: 567, isThrow: true })
      let rt2 = await api.get('test/nodb/getCache', { name: 'aaa' })
      assert.deepEqual(rt2, {})
    })

    it('tagCache', async function () {
      await api.post('test/nodb/setCache', { name: 'tag:aaa', value: 123 })
      let rt = await api.get('test/nodb/getCache', { name: 'tag:aaa' })
      assert.deepEqual(rt, { value: 123 })

      await theone.cache.tag('tag').clearTag()

      rt = await api.get('test/nodb/getCache', { name: 'tag:aaa' })
      assert.deepEqual(rt, {})

      await api.post('test/nodb/setCache', { name: 'tag:aaa', value: 567, isThrow: true })
      let rt2 = await api.get('test/nodb/getCache', { name: 'tag:aaa' })
      assert.deepEqual(rt2, {})
    })

    it('cache repeatedly', async function () {
      let rt = await api.post('test/nodb/cacheRepeatedly')
      assert.isTrue(rt)
    })
  })

  describe('model', function () {
    it('global model', async function () {
      let rt = await api.get('test/db/getModel')
      assert.equal(rt, 'global')
    })

    it('internal model', async function () {
      let rt = await admin.get('db/getModel')
      assert.equal(rt, 'internal')
    })

    it.only('model remember', async function () {
      let rt = await api.get('test/nodb/testRemember')
      assert.equal(rt, true)
    })
  })
})
