'use strict'

const Tester = require('../lib/tester')
const assert = require('chai').assert
const { its, its_seq, its_par } = require('zo-mocha-ext')

let tester = new Tester('http://localhost:18510', 'api', 'v1.0.0')

describe('tester', function() {
  its_par(10, 'request', async function() {
    let rt = await tester.request('account/login/loginByPhone', { phone: '123456', password: 'abcdef' })
    assert.deepEqual(rt.data, ['123456', 'abcdef'])
  })

  its_par(10, 'call', async function() {
    let rt = await tester.call('account/login/loginByPhone', { phone: '123456', password: 'abcdef' })
    assert.deepEqual(rt, ['123456', 'abcdef'])
  })
})