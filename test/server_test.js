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
        parsePath: () => isHandler = true
      })
      await api.get('test/nodb/succeed').catch(() => { })
      assert.isFalse(isHandler)

      await api.get('error-patch').catch(() => { })
      assert.isTrue(isHandler)
    })

    it('setErrorHandlers  callAction', async function () {
      let isHandler = false
      theone.app.setErrorHandlers({
        callAction: () => isHandler = true
      })
      await api.get('test/nodb/paramInt', { arg: '123' })
      assert.isFalse(isHandler)
      await api.get('test/nodb/paramInt', { arg: 'asdf324' }).catch(() => { })
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
  })
})
