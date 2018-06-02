'use strict'

const fs = require('fs')
const path = require('path')
const toUtil = require('./util')


module.exports = {
  DEF_CONFIG: {
    'appName': 'theone-server',
    'port': 18510,
    'httpsPort': 443,

    'modleDir': './db',

    //可通过数组配置多个 module
    'modules': {
      //模块名字 也是对应模块文件夹名
      'name': 'api',
      //相对 ROOT_DIR 的路径; 模块所在路径为 theone.path(parentDir, name)
      'parentDir': './',
      //只有以'Action'结尾且非'_'开头的函数 , 才对外暴露
      'actionSuffix': 'Action',
      //api 是否使用多版本
      'multiVersion': true,
      //强力推荐开启: 调用此模块内的每一个Action 都在主数据库事务中执行 (数据库表需要使用 innodb 引擎)
      'autoTransaction': true,
    },

    //可通过数组配置多个database   参考 https://github.com/sidorares/node-mysql2
    //主数据库: 唯一配置或数组的第一个配置
    'database': {
      //注意:非数据库名, 而是为该数据库连接起的名字, 多数据库配置不能重名! 
      //可以在 modle 和 controller 中通过 this.name 访问库的连接进行数据库操作
      'name': 'db',
      'host': 'localhost',
      'port': 3306,
      'user': 'root',
      'password': '',
      'database': '',
      'connectionLimit': 50,
      'queueLimit': 0,
      'waitForConnections': true
    },

    //简易配置仅支持两种类型 'stdout' 与 'file', 需要更全面的支持可配置 log['log4js']
    'log': {
      //'ALL' < 'TRACE'< 'DEBUG' = 'SQL'< 'INFO' < 'WARN'< 'ERROR' < 'FATAL'< 'MARK' < 'OFF'
      'level': 'DEBUG',
      'type': 'stdout',
      //当 type 是 file 的时候有效, 
      'file': {
        // 如果不指定默认会使用 config['appname'] + '.log',
        'filename': '',
        //pattern 也起到日志分文件的时间间隔  如: "yyyy-MM-dd-hh-mm-ss" 每秒分一个文件
        //注意: 当前日志不会追加 pattern, 等过期后就会重命名追加 pattern,  更多设置请使用 log['log4js'] 配置
        'pattern': '_yyyy-MM-dd',
        'compress': true
      },
      //原始的log4js配置, 如果配置此项则简易配置属性无效 (外部的'level','type','filename' 无效)
      'log4js': undefined,

      //为了更真实的反映sql执行情况,采用监听mysql general_log 的方式,
      //所以此配置生效必须满足以下前提:
      //1. theone.env.DEBUG 开启 
      //2. mysql 部署在本地且开启 general_log (使用root 执行: set global general_log=ON)
      'sqlLog': false,
    }
  },

  //如果配置属性重复, 不保证最后结果
  loadDir(obj, dir, ext) {
    let files = fs.readdirSync(dir)

    //深度遍历每个文件, 和文件夹
    for (let name of files) {
      let filePath = path.join(dir, name)
      let stat = fs.statSync(filePath)
      if (stat.isFile()) {
        if (path.extname(filePath) != ext) {
          continue
        }
        let baseName = path.basename(filePath, ext)
        if (baseName == 'config') {
          obj = toUtil.deepAssign(obj, require(filePath))
        } else {
          obj[baseName] = require(filePath)
        }
      } else {
        obj[name] = this.loadDir({}, filePath, ext)
      }
    }
    return obj
  },

  //针对允许配置 1个 或多个同类的配置,做调整(补充默认配置)
  adjustMultiConfig(obj, name, def) {
    let array = obj[name]
    if (Array.isArray(array)) {
      for (let i = 0; i < array.length; i++) {
        array[i] = toUtil.deepAssign(toUtil.deepCopy(def), array[i])
      }
    } else {
      obj[name] = [array]
    }
  },


  load(configDir, configExt = '.js') {
    let config = toUtil.deepCopy(this.DEF_CONFIG)
    this.loadDir(config, configDir, configExt)

    this.adjustMultiConfig(config, 'database', this.DEF_CONFIG['database'])
    this.adjustMultiConfig(config, 'modules', this.DEF_CONFIG['modules'])
    if (!config['log']['file']['filename']) {
      config['log']['file']['filename'] = config['appName']
    }
    return config
  }
}

toUtil.deepFreeze(module.exports.DEF_CONFIG)