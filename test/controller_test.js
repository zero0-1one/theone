'use strict'

const assert = require('chai').assert
const path = require('path')
const controller = require('../lib/controller')



describe('controller', function() {
  it('loadController', function() {
    let filePath = path.join(__dirname + '/test_api/v1.0/c.js')
    let data = controller.loadController(filePath, 'Action', 'c/')
    assert.deepEqual(data['c'].actions['c_2'].params, ['a', 'b'])
    assert.deepEqual(data['c'].actions['c_4'].params, ['x', 'y'])
  })

  it('loadModule', function() {
    let modulePath = path.join(__dirname + '/test_api/v1.0')
    let data = controller.loadModule(modulePath, 'Action')
    let expectation = [
      'c',
      'a/a1', 'a/a2', 'a/aa/aa1', 'a/aa/aa2', 'a/aa/aaa/aaa1',
      'b/b1', 'b/bb/bb1', 'b/bb/bb2',
    ]
    assert.hasAllKeys(data, expectation)
    assert.deepEqual(data['c'].actions['c_2'].params, ['a', 'b'])
    assert.deepEqual(data['c'].actions['c_4'].params, ['x', 'y'])
  })

  it('loadVersions', function() {
    let data = controller.loadVersions(path.join(__dirname + '/test_api'), 'Action')
    assert.hasAllKeys(data, ['v1.0', 'v1.1'])
    let expectation0 = [
      'c',
      'a/a1', 'a/a2', 'a/aa/aa1', 'a/aa/aa2', 'a/aa/aaa/aaa1',
      'b/b1', 'b/bb/bb1', 'b/bb/bb2',
    ]
    let expectation1 = ['a/a1', 'a/a2']
    assert.hasAllKeys(data['v1.0'], expectation0)
    assert.hasAllKeys(data['v1.1'], expectation1)
  })

  it('load', function() {

  })
})