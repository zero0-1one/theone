'use strict'

const assert = require('chai').assert
const path = require('path')
const config = require('../lib/config')

describe('config', function() {
  it('loadDir', function() {
    let data = config.loadDir({}, path.join(__dirname + '/test_config'), '.js')
    assert.deepEqual(data, {
      port: 17503,
      database: {
        host: '127.0.0.1',
        connectionLimit: 10,
      },

      root_a: 1,
      root_b: [
        1, 2, 3
      ],
      a: {
        a_a: 1,
        a_b: 'bbb'
      },
      b: {
        b_a: 'a',
        b_b: 123
      },
      x: {
        x_root_a: 100,
        x_root_b: {
          a: 123
        },
        c: {
          x_a: 100
        },
        d: ['a', 'b', 'c']
      }
    })
  })


  it('load', function() {
    let data = config.load(path.join(__dirname + '/test_config'), '.js')
    assert.deepEqual(data, {
      port: 17503,
      module: {
        name: 'api',
        parentDir: './',
        actionSuffix: 'Action',
        multiVersion: true
      },
      database: {
        user: 'root',
        password: '',
        connectionLimit: 50, //连接池大小
        queueLimit: 0,
        waitForConnections: true,
      },

      root_a: 1,
      root_b: [
        1, 2, 3
      ],
      a: {
        a_a: 1,
        a_b: 'bbb'
      },
      b: {
        b_a: 'a',
        b_b: 123
      },
      x: {
        x_root_a: 100,
        x_root_b: {
          a: 123
        },
        c: {
          x_a: 100
        },
        d: ['a', 'b', 'c']
      }
    })
  })
})