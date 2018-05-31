'use strict'

const util = require('util')
const log4js = require('log4js')

const levels = {
  'SQL': {
    'value': log4js.levels['DEBUG'].level,
    'colour': 'blue'
  }
}

const appenders = {
  'file': {
    'type': 'dateFile',
    'filename': '', // init 时候
    'pattern': '_yyyy-MM-dd-hh-mm-ss.log',
    'encoding': 'utf-8',
    'compress': true
  },
  'stdout': { 'type': 'stdout' },
}

let Loggers = {}
let initialized = false

let log = function(name = '') {
  if (!initialized) {
    throw new Error('Theone log has not been initialized')
  }
  if (!Loggers[name]) {
    Loggers[name] = log4js.getLogger(name)
  }
  return Loggers[name]
}

log.init = function(config) {
  Loggers = {} //清空
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
      cfg['appenders']['file']['filename'] = config['filename']
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
  await util.promisify(log4js.shutdown)()
}

module.exports = log