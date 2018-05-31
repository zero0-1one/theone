'use strict'

const assert = require('chai').assert
const path = require('path')
const controller = require('../lib/controller')



describe('api_call', function() {
  it('loadController', function() {
    let filePath = path.join(__dirname + '/test_api/v1.0/c.js')
    let data = controller.loadController(filePath, 'Action', 'c/')
    let expectation = ['c/c_2', 'c/c_4']
    assert.hasAllKeys(data, expectation)
    assert.deepEqual(data['c/c_2'].params, ['a', 'b'])
    assert.deepEqual(data['c/c_4'].params, ['x', 'y'])
  })

  it('loadModule', function() {
    let modulePath = path.join(__dirname + '/test_api/v1.0')
    let data = controller.loadModule(modulePath, 'Action')
    let expectation = [
      'c/c_2', 'c/c_4',

      'a/a1/a1_2', 'a/a1/a1_4',
      'a/a2/a2_2', 'a/a2/a2_4',
      'a/aa/aa1/aa1_2', 'a/aa/aa1/aa1_4',
      'a/aa/aa2/aa2_2', 'a/aa/aa2/aa2_4',
      'a/aa/aaa/aaa1/aaa1_2', 'a/aa/aaa/aaa1/aaa1_4',

      'b/b1/b1_2', 'b/b1/b1_4',
      'b/bb/bb1/bb1_2', 'b/bb/bb1/bb1_4',
      'b/bb/bb2/bb2_2', 'b/bb/bb2/bb2_4',
    ]
    assert.hasAllKeys(data, expectation)
    assert.deepEqual(data['c/c_2'].params, ['a', 'b'])
    assert.deepEqual(data['c/c_4'].params, ['x', 'y'])
  })

  it('loadVersions', function() {
    let data = controller.loadVersions(path.join(__dirname + '/test_api'), 'Action')
    assert.hasAllKeys(data, ['v1.0', 'v1.1'])
    let expectation0 = [
      'c/c_2', 'c/c_4',

      'a/a1/a1_2', 'a/a1/a1_4',
      'a/a2/a2_2', 'a/a2/a2_4',
      'a/aa/aa1/aa1_2', 'a/aa/aa1/aa1_4',
      'a/aa/aa2/aa2_2', 'a/aa/aa2/aa2_4',
      'a/aa/aaa/aaa1/aaa1_2', 'a/aa/aaa/aaa1/aaa1_4',

      'b/b1/b1_2', 'b/b1/b1_4',
      'b/bb/bb1/bb1_2', 'b/bb/bb1/bb1_4',
      'b/bb/bb2/bb2_2', 'b/bb/bb2/bb2_4',
    ]
    let expectation1 = [
      'a/a1/a1_2', 'a/a1/a1_4',
      'a/a2/a2_2', 'a/a2/a2_4',
    ]
    assert.hasAllKeys(data['v1.0'], expectation0)
    assert.hasAllKeys(data['v1.1'], expectation1)
  })

  it('load', function() {

  })
})