'use strict'

const assert = require('chai').assert
const path = require('path')
const toUtil = require('../lib/util')
const config = require('../lib/config')

const userConfig = {
  'port': 17503,
  'database': {
    'host': '127.0.0.1',
    'connectionLimit': 10,
  },
  'modules': [
    { 'name': 'api' },
    { 'name': 'admin' }
  ],
  'root_a': 1,
  'root_b': [
    1, 2, 3
  ],
  'a': {
    'a_a': 1,
    'a_b': 'bbb'
  },
  'b': {
    'b_a': 'a',
    'b_b': 123
  },
  'x': {
    'x_root_a': 100,
    'x_root_b': {
      'a': 123
    },
    'c': {
      'x_a': 100
    },
    'd': ['a', 'b', 'c']
  }
}

describe('config', function() {
  it('loadDir', function() {
    let data = config.loadDir({}, path.join(__dirname + '/test_config'), '.js')
    assert.deepEqual(data, userConfig)
  })

  it('load', function() {
    let data = config.load(path.join(__dirname + '/test_config'), '.js')
    let cfg = toUtil.deepCopy(config.DEF_CONFIG)
    let defModules = toUtil.deepCopy(config.DEF_CONFIG['modules'])
    toUtil.deepAssign(cfg, userConfig)
    cfg['databaseMap'] = {
      [cfg['database']['name']]:cfg['database']
    }
    cfg['database'] = [cfg['database']]
    cfg['modules'][0] = Object.assign(toUtil.deepCopy(defModules), cfg['modules'][0])
    cfg['modules'][1] = Object.assign(toUtil.deepCopy(defModules), cfg['modules'][1])
    cfg['log']['file']['filename'] = './runtime/logs/' + data['appName'] + '.log'
    cfg['cache']['dir'] = './runtime/cache/'
    assert.deepEqual(data, cfg)
  })
})