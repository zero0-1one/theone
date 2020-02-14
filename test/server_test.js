'use strict'

const Tester = require('../lib/tester')
const assert = require('chai').assert

let api = new Tester('http://localhost:18510', 'api', 'v1.0.0')
let admin = new Tester('http://localhost:18510', 'admin')

describe('server test', function () {
    describe('model', function () {
        it('global model', async function () {
            let rt = await api.get('test/db/getModel')
            assert.deepEqual(rt, 'global')
        })

        it('internal model', async function () {
            let rt = await admin.get('db/getModel')
            assert.deepEqual(rt, 'internal')
        })
    })
})
