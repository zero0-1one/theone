
const util = require('util')
const toUtil = require('./util')
const log4js = require('log4js')
const path = require('path')

const appenders = {
  'file': {
    'type': 'dateFile',
    'filename': '', // init 时候
    'pattern': '', // init 时候
    'encoding': 'utf-8',
    'compress': false
  },
  'stdout': { 'type': 'stdout' }
}

let loggers = {}
let initialized = false

let log = function (name = '') {
  if (!initialized) {
    throw new Error('Theone log has not been initialized')
  }
  if (!toUtil.hasOwnPropertySafe(loggers, name)) {
    loggers[name] = log4js.getLogger(name)
  }
  return loggers[name]
}

log.init = function (config, rootDir = './') {
  if (initialized) {
    throw new Error('Theone log has been initialized')
  }
  let levels = {
    'SQL': {
      'value': log4js.levels['DEBUG'].level,
      'colour': 'blue'
    }
  }
  let cfg = null
  if (config['log4js']) {
    cfg = toUtil.deepCopy(config['log4js'])
    cfg['levels'] = Object.assign(levels, config['log4js']['levels'])
    log4js.configure(cfg)
  } else {
    //简易配置
    let type = config['type']
    cfg = {
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
      let file = cfg['appenders']['file']
      Object.assign(file, config['file'])
      file['filename'] = path.join(rootDir, file['filename'])
    }
    if (config['log4jsAppend']) {
      Object.assign(cfg, config['log4jsAppend'])
    }
  }

  //pm2 启动,  通过 pm_id 分日志文件
  if (toUtil.hasOwnPropertySafe(process.env, 'pm_id')) {
    let pmIdStr = '_' + process.env.pm_id
    for (const name in cfg['appenders']) {
      let appender = cfg['appenders'][name]
      if (toUtil.hasOwnPropertySafe(appender, 'filename')) {
        let filename = appender['filename']
        let index = filename.lastIndexOf('.')
        if (index >= 0) {
          appender['filename'] = filename.substring(0, index) + pmIdStr + filename.substring(index)
        } else {
          appender['filename'] = filename + pmIdStr
        }
      }
    }
  }
  log4js.configure(cfg)

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

log.shutdown = async function () {
  loggers = {} //清空
  await util.promisify(log4js.shutdown)()
  initialized = false
}

module.exports = log
