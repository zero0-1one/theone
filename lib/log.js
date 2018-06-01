'use strict'

const util = require('util')
const log4js = require('log4js')

const appenders = {
  'file': {
    'type': 'dateFile',
    'filename': '', // init 时候
    'pattern': '', // init 时候
    'encoding': 'utf-8',
    'compress': false
  },
  'stdout': { 'type': 'stdout' },
}

let loggers = {}
let initialized = false

let log = function(name = '') {
  if (!initialized) {
    throw new Error('Theone log has not been initialized')
  }
  if (!loggers[name]) {
    loggers[name] = log4js.getLogger(name)
  }
  return loggers[name]
}

log.init = function(config) {
  if (initialized) {
    throw new Error('Theone server has been initialized')
  }
  let levels = {
    'SQL': {
      'value': log4js.levels['DEBUG'].level,
      'colour': 'blue'
    }
  }
  if (config['log4js']) {
    config['log4js']['levels'] = Object.assign(levels, config['log4js']['levels'])
    log4js.configure(config['log4js'])
  } else { //简易配置
    let type = config['type']
    let cfg = {
      'levels': levels,
      'appenders': {
        [type]: appenders[type]
      },
      'categories': {
        'default': {
          'appenders': [type],
          'level': config['level']
        }
      }
    }
    if (type == 'file') {
      Object.assign(cfg['appenders']['file'], config['file'])
    }
    log4js.configure(cfg)
  }

  initialized = true

  let defLog = log()
  for (let level of Object.keys(log4js.levels)) {
    level = level.toLowerCase()
    if (typeof defLog[level] != 'function') {
      continue
    }
    log[level] = defLog[level].bind(defLog)
  }
}


log.shutdown = async function() {
  loggers = {} //清空
  await util.promisify(log4js.shutdown)()
  initialized = false
}

module.exports = log