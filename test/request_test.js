'use strict'

const Client = require('./client')
const assert = require('chai').assert
const { its, its_seq, its_par } = require('zo-mocha-ext')

let client = new Client('v1.0.0', 'api')
let clearTable = async function () {
  let rt = await client.post('test/db/clearTable')
  assert.isTrue(rt)
}
const N = 1

describe('request_test', function () {

  it('getCallMid', async function () {
    await client.get('account/login/getCallMid')
    let rt = await client.get('account/login/getCallMid')
    assert.deepEqual(rt, ['midB', 'midA', 'midC'])
  })


  its_par(N, 'request', async function () {
    let rt = await client.get('account/login/loginByPhone', { phone: '123456', password: 'abcdef' })
    assert.deepEqual(rt, ['123456', 'abcdef'])
  })


  it('set and get session', async function () {
    await client.post('account/login/setSession', { data: 123 })
    await client.post('account/login/setSession', { data: 234 })
    let rt = await client.post('account/login/getSession')
    assert.deepEqual(rt, 234)
  })


  it('set and get token', async function () {
    await client.get('account/login/createToken', { data: 123 })
    let token = await client.post('account/login/createToken', { data: 234 })
    let rt = await client.post('account/login/getToken', {}, { header: { authorization: 'Bearer ' + token } })
    assert.deepEqual(rt.data, 234)
  })


  describe('nodb parallel', function () {
    its_par(N, 'succeed (nodb)', async function () {
      let rt = await client.get('test/nodb/succeed')
      assert.deepEqual(rt, 'succeed')
    })

    its_par(N, 'failed (nodb)', async function () {
      let rt = await client.get('test/nodb/failed')
      assert.deepEqual(rt, 'failed')
    })

    its_par(N, 'error (nodb)', async function () {
      let rt = await client.get('test/nodb/error')
      assert.equal(rt, 'error')
    })

    its_par(N, 'throw (nodb)', async function () {
      let rt = await client.post('test/nodb/throw')
      assert.instanceOf(rt, Error)
    })
  })

  describe('db parallel', function () {
    its_par(N, 'succeed (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let rt = await client.get('test/db/succeed', { key: 'aaa', value: iter })
      assert.deepEqual(rt, 'succeed')
      await this.afterAll(async () => {
        let rt = await client.get('test/db/getRows')
        assert.equal(rt, N)
      })
    })

    its_par(N, 'failed (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let rt = await client.get('test/db/failed', { key: 'aaa', value: iter })
      assert.deepEqual(rt, 'failed')
      await this.afterAll(async () => {
        let rt = await client.get('test/db/getRows')
        assert.equal(rt, N)
      })
    })

    its_par(N, 'error (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let rt = await client.get('test/db/error', { key: 'aaa', value: iter })
      assert.equal(rt, 'error')
      await this.afterAll(async () => {
        let rt = await client.get('test/db/getRows')
        assert.equal(rt, 0)
      })
    })

    its_par(N, 'throw (db)', async function () {
      await this.beforeAll(clearTable)
      let rt = await client.post('test/db/throw')
      assert.instanceOf(rt, Error)
      await this.afterAll(async () => {
        let rt = await client.get('test/db/getRows')
        assert.equal(rt, 0)
      })
    })
  })

  describe('db sequence', function () {
    its_seq(N, 'succeed (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let rt = await client.get('test/db/succeed', { key: 'aaa', value: iter })
      assert.deepEqual(rt, 'succeed')
      await this.afterAll(async () => {
        let rt = await client.get('test/db/getRows')
        assert.equal(rt, N)
      })
    })

    its_seq(N, 'failed (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let rt = await client.get('test/db/failed', { key: 'aaa', value: iter })
      assert.deepEqual(rt, 'failed')
      await this.afterAll(async () => {
        let rt = await client.get('test/db/getRows')
        assert.equal(rt, N)
      })
    })

    its_seq(N, 'error (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let rt = await client.get('test/db/error', { key: 'aaa', value: iter })
      assert.equal(rt, 'error')
      await this.afterAll(async () => {
        let rt = await client.get('test/db/getRows')
        assert.equal(rt, 0)
      })
    })

    its_seq(N, 'throw (db)', async function () {
      await this.beforeAll(clearTable)
      let iter = this.iteration
      let isThrow = false
      let rt = await client.post('test/db/throw').catch(() => {
        isThrow = true
      })
      await this.afterAll(async () => {
        let rt = await client.get('test/db/getRows')
        assert.equal(rt, 0)
      })
    })
  })
})