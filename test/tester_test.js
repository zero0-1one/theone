'use strict'

const Tester = require('../lib/tester')
const assert = require('chai').assert
const { its, its_seq, its_par } = require('zo-mocha-ext')

let tester = new Tester('http://localhost:18510', 'api', 'v1.0.0')

let clearTable = async function () {
  let rt = await tester.post('test/db/clearTable')
  assert.isTrue(rt)
}
const N = 1

describe('tester', function () {

  it('getCallMid', async function () {
    await tester.get('account/login/getCallMid')
    let rt = await tester.get('account/login/getCallMid')
    assert.deepEqual(rt, ['midB', 'midA', 'midC'])
  })


  its_par(N, 'request', async function () {
    let rt = await tester.get('account/login/loginByPhone', { phone: '123456', password: 'abcdef' })
    assert.deepEqual(rt, ['123456', 'abcdef'])
  })


  it('set and get session', async function () {
    await tester.get('account/login/setSession', { data: 123 })
    await tester.get('account/login/setSession', { data: 234 })
    let rt = await tester.get('account/login/getSession')
    assert.deepEqual(rt, 234)
  })

  describe('nodb parallel', function () {

    its_par(N, 'succeed (nodb)', async function () {
      let rt = await tester.get('test/nodb/succeed')
      assert.deepEqual(rt, 'succeed')
    })

    its_par(N, 'failed (nodb)', async function () {
      let rt = await tester.request('get', 'test/nodb/failed')
      assert.deepEqual(rt, 'failed')
    })

    its_par(N, 'error (nodb)', async function () {
      let rt = await tester.request('get', 'test/nodb/error')
      assert.equal(rt, 'error')
    })

    its_par(N, 'throw (nodb)', async function () {
      let isThrow = false
      let rt = await tester.request('post', 'test/nodb/throw').catch(() => {
        isThrow = true
      })
      assert.isTrue(isThrow)
    })
  })

  describe('db parallel', function () {
    its_par(N, 'succeed (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let rt = await tester.get('test/db/succeed', { key: 'aaa', value: iter })
      assert.deepEqual(rt, 'succeed')
      await this.afterAll(async () => {
        let rt = await tester.get('test/db/getRows')
        assert.equal(rt, N)
      })
    })

    its_par(N, 'failed (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let rt = await tester.get('test/db/failed', { key: 'aaa', value: iter })
      assert.deepEqual(rt, 'failed')
      await this.afterAll(async () => {
        let rt = await tester.get('test/db/getRows')
        assert.equal(rt, N)
      })
    })

    its_par(N, 'error (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let rt = await tester.get('test/db/error', { key: 'aaa', value: iter })
      assert.equal(rt, 'error')
      await this.afterAll(async () => {
        let rt = await tester.get('test/db/getRows')
        assert.equal(rt, 0)
      })
    })

    its_par(N, 'throw (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let isThrow = false
      let rt = await tester.request('post', 'test/db/throw').catch(() => {
        isThrow = true
      })
      assert.isTrue(isThrow)
      await this.afterAll(async () => {
        let rt = await tester.get('test/db/getRows')
        assert.equal(rt, 0)
      })
    })
  })

  describe('db sequence', function () {
    its_seq(N, 'succeed (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let rt = await tester.get('test/db/succeed', { key: 'aaa', value: iter })
      assert.deepEqual(rt, 'succeed')
      await this.afterAll(async () => {
        let rt = await tester.get('test/db/getRows')
        assert.equal(rt, N)
      })
    })

    its_seq(N, 'failed (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let rt = await tester.get('test/db/failed', { key: 'aaa', value: iter })
      assert.deepEqual(rt, 'failed')
      await this.afterAll(async () => {
        let rt = await tester.get('test/db/getRows')
        assert.equal(rt, N)
      })
    })

    its_seq(N, 'error (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let rt = await tester.get('test/db/error', { key: 'aaa', value: iter })
      assert.equal(rt, 'error')
      await this.afterAll(async () => {
        let rt = await tester.get('test/db/getRows')
        assert.equal(rt, 0)
      })
    })

    its_seq(N, 'throw (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let isThrow = false
      let rt = await tester.request('post', 'test/db/throw').catch(() => {
        isThrow = true
      })
      await this.afterAll(async () => {
        let rt = await tester.get('test/db/getRows')
        assert.equal(rt, 0)
      })
    })
  })
})