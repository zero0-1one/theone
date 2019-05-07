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
  its_par(N, 'request', async function () {
    let rt = await tester.get('account/login/loginByPhone', { phone: '123456', password: 'abcdef' })
    assert.deepEqual(rt, ['123456', 'abcdef'])
  })

  // describe('nodb parallel', function () {

  //   its_par(N, 'succeed (nodb)', async function () {
  //     let rt = await tester.get('test/nodb/succeed')
  //     assert.deepEqual(rt, { status: 1, data: 'succeed' })
  //   })

  //   its_par(N, 'failed (nodb)', async function () {
  //     let rt = await tester.request('test/nodb/failed')
  //     assert.deepEqual(rt, { status: 0, msg: 'failed' })
  //   })

  //   its_par(N, 'error (nodb)', async function () {
  //     let rt = await tester.request('test/nodb/error')
  //     assert.equal(rt.status, -2)
  //   })

  //   its_par(N, 'throw (nodb)', async function () {
  //     let rt = await tester.request('test/nodb/throw')
  //     assert.equal(rt.status, -1)
  //   })
  // })

  // describe('db parallel', function () {
  //   its_par(N, 'succeed (db)', async function () {
  //     await this.beforeAll(clearTable)
  //     let iter = this.iteration
  //     let rt = await tester.request('test/db/succeed', { key: 'aaa', value: iter })
  //     assert.deepEqual(rt, { status: 1, data: 'succeed' })
  //     await this.afterAll(async () => {
  //       let rt = await tester.call('test/db/getRows')
  //       assert.equal(rt, N)
  //     })
  //   })

  //   its_par(N, 'failed (db)', async function () {
  //     await this.beforeAll(clearTable)
  //     let iter = this.iteration
  //     let rt = await tester.request('test/db/failed', { key: 'aaa', value: iter })
  //     assert.deepEqual(rt, { status: 0, msg: 'failed' })
  //     await this.afterAll(async () => {
  //       let rt = await tester.call('test/db/getRows')
  //       assert.equal(rt, N)
  //     })
  //   })

  //   its_par(N, 'error (db)', async function () {
  //     await this.beforeAll(clearTable)
  //     let iter = this.iteration
  //     let rt = await tester.request('test/db/error', { key: 'aaa', value: iter })
  //     assert.equal(rt.status, -2)
  //     await this.afterAll(async () => {
  //       let rt = await tester.call('test/db/getRows')
  //       assert.equal(rt, 0)
  //     })
  //   })

  //   its_par(N, 'throw (db)', async function () {
  //     await this.beforeAll(clearTable)
  //     let iter = this.iteration
  //     let rt = await tester.request('test/db/throw', { key: 'aaa', value: iter })
  //     assert.equal(rt.status, -1)
  //     await this.afterAll(async () => {
  //       let rt = await tester.call('test/db/getRows')
  //       assert.equal(rt, 0)
  //     })
  //   })
  // })

  // describe('db sequence', function () {
  //   its_seq(N, 'succeed (db)', async function () {
  //     await this.beforeAll(clearTable)
  //     let iter = this.iteration
  //     let rt = await tester.request('test/db/succeed', { key: 'aaa', value: iter })
  //     assert.deepEqual(rt, { status: 1, data: 'succeed' })
  //     await this.afterAll(async () => {
  //       let rt = await tester.call('test/db/getRows')
  //       assert.equal(rt, N)
  //     })
  //   })

  //   its_seq(N, 'failed (db)', async function () {
  //     await this.beforeAll(clearTable)
  //     let iter = this.iteration
  //     let rt = await tester.request('test/db/failed', { key: 'aaa', value: iter })
  //     assert.deepEqual(rt, { status: 0, msg: 'failed' })
  //     await this.afterAll(async () => {
  //       let rt = await tester.call('test/db/getRows')
  //       assert.equal(rt, N)
  //     })
  //   })

  //   its_seq(N, 'error (db)', async function () {
  //     await this.beforeAll(clearTable)
  //     let iter = this.iteration
  //     let rt = await tester.request('test/db/error', { key: 'aaa', value: iter })
  //     assert.equal(rt.status, -2)
  //     await this.afterAll(async () => {
  //       let rt = await tester.call('test/db/getRows')
  //       assert.equal(rt, 0)
  //     })
  //   })

  //   its_seq(N, 'throw (db)', async function () {
  //     await this.beforeAll(clearTable)
  //     let iter = this.iteration
  //     let rt = await tester.request('test/db/throw', { key: 'aaa', value: iter })
  //     assert.equal(rt.status, -1)
  //     await this.afterAll(async () => {
  //       let rt = await tester.call('test/db/getRows')
  //       assert.equal(rt, 0)
  //     })
  //   })
  // })
})