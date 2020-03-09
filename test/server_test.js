'use strict'

const Tester = require('../lib/tester')
const assert = require('chai').assert

let api = new Tester('http://localhost:18510', 'api', 'v1.0.0')
let admin = new Tester('http://localhost:18510', 'admin')

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
