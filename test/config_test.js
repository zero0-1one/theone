'use strict'

const path = require('path')
const toUtil = require('../lib/util')
const config = require('../lib/config')
const chai = require('chai')
const assert = chai.assert
const expect = chai.expect
chai.use(require('chai-like'))

const userConfig = {
  'port': 17503,
  'database': {
    'name': 'db',
    'host': '127.0.0.1',
    'connectionLimit': 10,
  },
  'modules': [
    {
      'name': 'api',
      'database': 'db',
      'mainDb': 'db',
    },
    {
      'name': 'admin',
      'database': 'db',
      'mainDb': 'db',
    },
  ],
  'root_a': 1,
  'root_b': [1, 2, 3],
  'a': {
    'a_a': 1,
    'a_b': 'bbb',
  },
  'b': {
    'b_a': 'a',
    'b_b': 123,
  },
  'x': {
    'x_root_a': 100,
    'x_root_b': {
      'a': 123,
    },
    'c': {
      'x_a': 100,
    },
    'd': ['a', 'b', 'c'],
  },
}

describe('config', function () {
  it('loadDir', function () {
    let data = config.loadDir({}, path.join(__dirname + '/test_config'))
    assert.deepEqual(data, userConfig)
  })

  it('load', function () {
    let data = config.load(path.join(__dirname + '/test_config'))
    let cfg = toUtil.deepCopy(config.DEF_CONFIG)
    cfg.session.store = config.DEF_CONFIG.session.store
    let defModules = toUtil.deepCopy(config.DEF_CONFIG['modules'])
    toUtil.deepAssign(cfg, userConfig)
    cfg['databaseMap'] = {
      [cfg['database']['name']]: cfg['database'],
    }
    delete data['workers']
    cfg['database'] = [cfg['database']]
    cfg['modules'][0] = Object.assign(toUtil.deepCopy(defModules), cfg['modules'][0])
    cfg['modules'][1] = Object.assign(toUtil.deepCopy(defModules), cfg['modules'][1])
    cfg['modules'][0].database = cfg['modules'][1].database = [cfg['databaseMap']['db']]
    cfg['log']['file']['filename'] = './runtime/logs/' + data['appName'] + '.log'
    cfg['cache']['adapter']['file']['dir'] = './runtime/cache/'
    expect(cfg).to.deep.like(data)
  })
})
