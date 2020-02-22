'use strict'

const fs = require('fs')
const path = require('path')
const toUtil = require('./util')

module.exports = {
  DEF_CONFIG: {
    'appName': 'theone-server',
    'port': 18510,
    'https': {
      'port': 443,
      'keyFilename': '', //绝对或相对ROOT_DIR的路径
      'certFilename': '' //绝对或相对ROOT_DIR的路径
    },

    //如果为 false 则禁用 static,  建议生产环境下使用 Nginx 等
    'staticDir': false, // './public/',
    'modelDir': './model',
    'middlewareDir': './middleware',


    //可通过数组配置多个database   参考 https://github.com/sidorares/node-mysql2
    //主数据库: 唯一配置或数组的第一个配置
    'database': {
      //注意:非数据库名, 而是为该数据库连接起的名字, 多数据库配置不能重名!
      //可以在 model 和 controller 中通过 this.name 访问库的连接进行数据库操作
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

    //可通过数组配置多个 module
    'modules': {
      //模块名字 也是对应模块文件夹名
      'name': 'api',
      //相对 ROOT_DIR 的路径; 模块所在路径为 theone.path(parentDir, name)
      'parentDir': './',
      //是否内置model,  如果为true 则 model 目录为 theone.path(parentDir, name, modelDir)
      'internalModel': false,

      //默认:只有以'Action'结尾且非'_'开头的函数 , 才对外暴露.
      //也可设置为''则接口名与函数名一致,但不推荐这样做, 因为容易忘记给私有方法名前加'_', 而产生安全漏洞
      'actionSuffix': 'Action',
      //是否启动 Action 参数自动类型转换,  
      'autoTypeConversion': true,

      //该模块是否使用多版本
      'multiVersion': false,
      //controller 类是否自动继承上个版本, 只有在 multiVersion 为 true 时候生效
      //!注意:为了效率采用的是覆盖原型链方式实现继承效果, 而非 extends, 所以不要在 controller 文件中使用 super 关键字
      //如果需要禁用上个版本的某个 action, 可在 当前版本的 action 前加 '_'
      'autoExtends': true,

      //每个模块可以独立指定使用的数据库, 如果为 undefined 则使用全局的 database 设置
      //模块 database 设置与全局 database 相同,  另外还支持只填写全局 database 的 name; 如 'db' 或["db", 'log'] 
      'database': undefined,

      //强力推荐开启: 调用此模块内的每一个Action 都在主数据库事务中执行 (数据库表需要使用 innodb 引擎)
      'autoTransaction': true,
      //autoTransaction 为 true 此属性才有意义. 每个模块可以独立指定主数据库名(配置表中的 database.name 而非数据库名),
      //如果不指定则为 该模块 database[0].name
      'mainDb': undefined,

    },

    'session': {
      'key': 'theone-session-id', //cookie key
      'maxAge': 86400000, // cookie的过期时间 maxAge in ms (default is 1 days)
      'overwrite': true, //是否可以overwrite    (默认default true)
      'httpOnly': true, //cookie是否只有服务器端可以访问 httpOnly or not (default true)
      'signed': true, //签名默认true
      'rolling': false, //在每次请求时强行设置cookie，这将重置cookie过期时间（默认：false）
      'renew': false, //(boolean) renew session when session is nearly expired,
      'store': {
        // session 外部存储 默认使用 文件 cache      如果为 null, 则使用 cookie 存储数据
        async get(key, maxAge, { rolling }) {
          //maxAge (单位 ms)
          let sess = await theone.cache.get(key)
          if (rolling && sess !== undefined) await theone.cache.set(key, sess, maxAge / 1000)
          return sess
        },
        async set(key, sess, maxAge, { rolling, changed }) {
          if (changed || rolling) {
            await theone.cache.set(key, sess, maxAge / 1000)
          }
        },
        async destroy(key) {
          await theone.cache.clear(key)
        }
      }
    },

    //简易配置仅支持两种类型 'stdout' 与 'file', 需要更全面的支持可配置 log['log4js']
    'log': {
      //'ALL' < 'TRACE'< 'DEBUG' = 'SQL'< 'INFO' < 'WARN'< 'ERROR' < 'FATAL'< 'MARK' < 'OFF'
      'level': 'DEBUG',
      'type': 'stdout',
      //当 type 是 file 的时候有效,
      'file': {
        //如果不指定, 默认会使用 ROOT_DIR/runtime/logs/config['appname'] + '.log',
        'filename': '',
        //pattern 也起到日志分文件的时间间隔  如: "yyyy-MM-dd-hh-mm-ss" 每秒分一个文件
        //注意: 当前日志不会追加 pattern, 等过期后就会重命名追加 pattern,  更多设置请使用 log['log4js'] 配置
        'pattern': '_yyyy-MM-dd',
        'compress': true
      },
      //原始的log4js配置, 如果配置此项则简易配置属性无效 (外部的'level','type','filename' 无效)
      'log4js': undefined,
      //简易配置下('log4js'为undefined) , 添加 log4js 配置
      'log4jsAppend': {},
      //为了更真实的反映sql执行情况,采用监听mysql general_log 的方式,
      //所以此配置生效必须满足以下前提:
      //1. theone.env.DEBUG 开启
      //2. mysql 部署在本地且开启 general_log (每次重启 mysql 后使用 root 执行: set global general_log=ON)
      'sqlLog': false
    },

    //内置的为文件缓存
    'cache': {
      //如果不指定,默认会使用 ROOT_DIR/runtime/cache/,
      'dir': '',
      //单位(秒), 默认缓存时间.  0:为永久.     如果传 null 或 undefined 则使用默认 timeout
      'timeout': 15 * 60,
      //gc 定时任务默认每天凌晨4点， 使用 node-schedule,   参考 https://github.com/node-schedule/node-schedule
      'gcSchedule': '0 0 4 * * *',
    }
  },

  loadConfig(filePath, envName = '') {
    let data = require(filePath)
    if (envName) {
      if (data.hasOwnProperty(envName)) {
        if (data.hasOwnProperty('common')) { //有 envName common 才生效
          return Object.assign({}, data['common'], data[envName])
        } else {
          return data[envName]
        }
      }
    }
    return data
  },

  //如果配置属性重复, 不保证最后结果
  loadDir(obj, dir, envName, ext = '.js') {
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
          obj = toUtil.deepAssign(obj, this.loadConfig(filePath, envName))
        } else {
          obj[baseName] = this.loadConfig(filePath, envName)
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

  load(configDir, envName, configExt) {
    let config = toUtil.deepCopy(this.DEF_CONFIG)
    config.session.store = this.DEF_CONFIG.session.store
    this.loadDir(config, configDir, envName, configExt)

    this.adjustMultiConfig(config, 'database', this.DEF_CONFIG['database'])
    this.adjustMultiConfig(config, 'modules', this.DEF_CONFIG['modules'])

    if (!config['log']['file']['filename']) {
      config['log']['file']['filename'] = './runtime/logs/' + config['appName'] + '.log'
    }
    if (!config['cache']['dir']) {
      config['cache']['dir'] = './runtime/cache/'
    }
    config['databaseMap'] = {}
    for (let db of config['database']) {
      config['databaseMap'][db['name']] = db
    }

    for (const module of config['modules']) {
      if (!module['mainDb']) module['mainDb'] = config['database'][0]['name']
      if (!module['database']) {
        module['database'] = config['database']
      } else if (typeof module['database'] == 'string') {
        module['database'] = [config['databaseMap'][module['database']]]
      } else {// if(Array.isArray(module['database']))
        module['database'] = module['database'].map(opt => typeof opt == 'string' ? config['databaseMap'][opt] : opt)
      }
    }

    return config
  }
}

toUtil.deepFreeze(module.exports.DEF_CONFIG)
