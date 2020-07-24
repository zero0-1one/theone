const fs = require('fs')
const path = require('path')
const toUtil = require('./util')

/**
 * 支持 path obj 写法如: {'a.b.c':1}  等价于 {a:{b:{c:1}}}  且会覆盖 默认配置选项, 如果是环境配置表会先覆盖 common 属性
 */
module.exports = {
  DEF_CONFIG: {
    'appName': 'theone-server',
    'port': 18510,
    'https': {
      'port': 443,
      'keyFilename': '', //绝对或相对ROOT_DIR的路径
      'certFilename': '', //绝对或相对ROOT_DIR的路径
    },

    'static': {
      //是否启用 static  建议生产环境下使用 Nginx 等
      'enabled': false,
      //相对 ROOT_DIR 的路径  默认 public
      'dir': './public/',
      //koa-static 配置项 参考 https://github.com/koajs/static
      'opts': {},
    },

    'modelDir': './model',

    /**
      controller 类中指定 middleware 的方法,是定义一个静态方法 middleware() 返回多个中间件的数组, 如下:
      static middleware() {
        return [
           'otherMiddleware',  //直接指定中间件名字
          { name: 'adminAuth', args: '超级管理员' },  //对象形式指定中间件名字和参数
        ]
      }
     */
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
      'waitForConnections': true,
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
      'actionSuffix': '_Action',
      //是否启动 Action 参数自动类型转换,
      'autoTypeConversion': true,

      //该模块是否使用多版本, 可设置为 [min, max], 则只会启动在 min, max 之间的版本(min,max 也可为null 不限制对应的边界)
      //例如 multiVersion 设置如下:
      //  true: 启动所有版本.    false: 不使用多版本模式
      // ['v1.0.0', 'v2.1.0']  启动 v1.0.0-v2.1.0 版本;   ['v1.0.0', null]:启动v1.0.0及以上的版本;  [null, null]: 启动所有版本
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

      //模块自动加载的 中间件列表, 写与 controller 中的 static middleware() 方法返回的数组相同,
      //另外相比前者多了一个 unless 配置,可以通过 ctrlName 来过滤不需要加载中间件的 controller
      //每个中间件配置 {name:'midA', args:{} , unless:({ctrlName})=>ctrlName =='noMidA' }
      'middleware': [],
    },

    //设置签名的 Cookie 密钥。
    'keys': null,

    //参看 koa-jwt 和 jsonwebtoken (https://github.com/koajs/jwt ,  https://github.com/auth0/node-jsonwebtoken)
    'jwt': {
      'enabled': false, //是否启用 jwt 功能

      'key': 'user', //默认(或不设置)通过 ctx.state.user 访问
      'secret': null, //启动 jwt 必须配置 'secret' ,
      'unless': {
        'path': [/^\/public/],
        'custom': null, //自定义函数, 返回true 则不运行 koa-jwt
      },
      'isRevoked': null, //可指定一个异步函数检测 token 是否失效, 默认null:在有效期内都有效

      'options': {
        // jsonwebtoken.sign() 的第三个参数
        'expiresIn': 2 * 60 * 60, //number类型单位 s,  也可写 '2h','1d' 等式样,   注意!! string类型 '120' 代表120毫秒! (写法参看 jsonwebtoken )
      },
    },

    //参看 koa-session  https://github.com/koajs/session
    'session': {
      'enabled': false, //是否禁用 session 默认关闭, 推荐使用 jwt 更灵活,适用面广,支持跨域.  比如微信小程序就无法直接使用 cookie

      'key': 'theone-session-id', //cookie key
      'maxAge': 86400000, // cookie 的过期时间 maxAge in ms (default is 1 days)
      'overwrite': true, //是否可以overwrite    (默认default true)
      'httpOnly': true, //cookie是否只有服务器端可以访问 httpOnly or not (default true)

      //签名默认false, 因为默认使用的 服务器 store， cookie中没有敏感数据.
      //如果 signed 为 true 则必须指定 config['keys']
      'signed': false,
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
        },
      },
    },

    //简易配置仅支持两种类型 'stdout' 与 'file', 需要更全面的支持可配置 log['log4js']
    'log': {
      //'ALL' < 'TRACE'< 'DEBUG' = 'SQL'< 'INFO' < 'WARN'< 'ERROR' < 'FATAL'< 'MARK' < 'OFF'
      'level': 'DEBUG',
      'type': 'stdout',
      //当 type 是 file 的时候有效,
      'file': {
        //如果不指定, 默认会使用 ROOT_DIR/runtime/logs/config['appName'] + '.log',
        'filename': '',
        //pattern 也起到日志分文件的时间间隔  如: "yyyy-MM-dd-hh-mm-ss" 每秒分一个文件
        //注意: 当前日志不会追加 pattern, 等过期后就会重命名追加 pattern,  更多设置请使用 log['log4js'] 配置
        'pattern': '_yyyy-MM-dd',
        'compress': true,
      },
      //原始的log4js配置, 如果配置此项则简易配置属性无效 (外部的'level','type','filename' 无效)
      'log4js': undefined,
      //简易配置下('log4js'为undefined) , 添加 log4js 配置,

      'log4jsAppend': {
        // 'pm2': true,                //pm2 部署会自动追加
        // 'disableClustering': true,  //pm2 部署会自动追加
      },
      //为了更真实的反映sql执行情况,采用监听mysql general_log 的方式,
      //所以此配置生效必须满足以下前提:
      //1. theone.env.DEBUG 开启
      //2. mysql 部署在本地且开启 general_log (每次重启 mysql 后使用 root 执行: set global general_log=ON)
      'sqlLog': false,
    },

    //默认 cache 可以直接通过 theone.cache() 或 theone.cache.get/set/clear/remember()  使用,
    //非默认 cache 需要通过 theone.getCache(adapterName) 或 theone.getCache(adapterOptions) 获取 cache 后使用上述方法
    //可以使用带标签的 cache, 如: theone.cache.tag(tagName) 或 theone.getCache(adapterName/adapterOptions, tagName)
    'cache': {
      //配置适配器
      'adapter': {
        // 内置的文件缓存
        'file': {
          //缓存适配器类
          //需要拥有 constructor 及 clear, get, set, gc 成员方法, 原型如下:
          // constructor(options)
          // async clear(name, tag)
          // async get(name, tag)
          // async set(name, data, tag)
          // async gc(isExpired)
          'Adapter': require('./cacheAdapter/file'), //file类型默认内置 Adapter
          //如果不指定,默认会使用 ROOT_DIR/runtime/cache/,
          'dir': '',
          //单位(秒), 默认缓存时间.  0:为永久.  如果传 null 或 undefined 则使用默认 timeout
          'timeout': 60 * 60,
          //gc 定时任务默认每天凌晨4点， 如果为 null 则不执行 gc. 使用 node-schedule,  参考 https://github.com/node-schedule/node-schedule
          'gcSchedule': '0 0 4 * * *',
          //完整 gc 一次需要的次数（取值大于等于1的整数）。 默认1： 每次gc检查所有缓存。 比如 gcCompleteTimes 为 2 每次gc只检查一半。则每2次才会全面检查一遍
          'gcCompleteTimes': 1,
        },
        'memory': {
          'Adapter': require('./cacheAdapter/memory'), //memory类型默认内置 Adapter
          'timeout': 60 * 60,
        },
      },
      // 指定默认的 适配器
      'default': 'file',
      //缓存的数字版本号, 修改它将使所有类型的所有 cache 在重启服务器时失效,  通常它应该是递增的,永远不重复
      'version': 0,
    },

    //有密集型计算需求的，可配置此项开启 worker_threads, 在 worker 线程中提供 具备与主线程的 theone 环境
    //可通过数组配置多个 worker 模块， 具备与 modules 类似的编程体验
    'workers': {
      //是否开启该worker线程
      'open': false,
      //该worker线程的名字 可在通过 theone.evn.WORKER_NAME 获取，主线程值为 'main' 也可以通过 theone.app 是否存在来断。
      'name': '',
      //启动的实例个数, 可在通过 theone.evn.WORKER_INST_ID 获取对应实例 id （编号从 0 开始）
      'instances': 1,
      //通过 only 指定启动该 worker 线程的 appNodeName 及 appNodeInstId ， 默认：空(则所有节点所有实例都启动)
      'only': {
        'appNodeName': null,
        'appNodeInstId': null,
      },
      //相对 ROOT_DIR 的路径; Worker 所在路径为 theone.path(parentDir, name)
      'dir': '',
      //该worker线程初始化入库，会在线程启动最初加载 此时 theone 还没初始化。(可以是绝对或相对ROOT_DIR的路径)
      'init': '',
      //该worker线程的入口文件，会在线程theone 初始化后加载， (可以是绝对或相对ROOT_DIR的路径)
      'entry': '',
      //默认:只有以'Action'结尾且非'_'开头的函数, 才对外暴露.
      //也可设置为''则接口名与函数名一致, 但不推荐这样做, 因为容易忘记给私有方法名前加'_', 而产生安全漏洞
      'actionSuffix': '_Action',

      //当worker线程退出后是否自动重启 默认：true
      'autorestart': true,
      // 心跳间隔单位 s， 默认：60秒。 当主线程超出 2倍 heartbeat 时间没有收到 worker 线程的心跳时会自动重启线程
      'heartbeat': 60,
      //是否开启 debug 模式方便调试，将不开启新线程，而是在主线程加载入口文件。（注意！仅在 theone.env.DEBUG 开启时有效）
      'debug': false,

      //每个 Worker 模块可以独立指定使用的数据库, 如果为 undefined 则使用全局的 database 设置
      //模块 database 设置与全局 database 相同,  另外还支持只填写全局 database 的 name; 如 'db' 或["db", 'log']
      'database': undefined,

      //强力推荐开启: 调用此 Worker 模块内的每一个Action 都在主数据库事务中执行 (数据库表需要使用 innodb 引擎)
      'autoTransaction': true,
      //autoTransaction 为 true 此属性才有意义. 每个模块可以独立指定主数据库名(配置表中的 database.name 而非数据库名),
      //如果不指定则为 该模块 database[0].name
      'mainDb': undefined,
    },
  },

  //配置文件的 rootObj  有名为 envName 的属性时候被认为是  env config.  可配置不同环境下不同的配置项, 且环境相同的共同项可以在 common 属性中配置,
  //当 rootObj 存在 common 属性时候, 环境配置中可使用 path 模式设置差异项.
  envConfig(data, envName) {
    if (toUtil.hasOwnPropertySafe(data, 'common')) {
      //有 envName common 才生效
      return toUtil.deepAssign(data['common'], data[envName] || {})
    } else {
      return data[envName]
    }
  },

  loadConfig(filePath, envName = '') {
    let data = require(filePath)
    if (envName && toUtil.hasOwnPropertySafe(data, envName)) {
      return this.envConfig(data, envName)
    }
    return data
  },

  //如果配置属性重复, 不保证最后结果
  loadDir(obj, dir, envName) {
    let files = fs.readdirSync(dir)

    //深度遍历每个文件, 和文件夹
    for (let name of files) {
      let filePath = path.join(dir, name)
      let stat = fs.statSync(filePath)
      if (stat.isFile()) {
        if (path.extname(filePath) != '.js') {
          continue
        }
        let baseName = path.basename(filePath, '.js')
        if (baseName == 'config') {
          toUtil.deepAssign(obj, this.loadConfig(filePath, envName))
        } else {
          toUtil.deepAssign(obj, { [baseName]: this.loadConfig(filePath, envName) })
        }
      } else {
        toUtil.deepAssign(obj, { [name]: this.loadDir({}, filePath, '.js') })
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
    } else if (array) {
      obj[name] = [array]
    }
  },

  completeDatabase(data, config) {
    for (const module of data) {
      if (!module['mainDb']) module['mainDb'] = config['database'][0]['name']
      if (!module['database']) {
        module['database'] = config['database']
      } else if (typeof module['database'] == 'string') {
        module['database'] = [config['databaseMap'][module['database']]]
      } else {
        module['database'] = module['database'].map(opt => (typeof opt == 'string' ? config['databaseMap'][opt] : opt))
      }
    }
  },

  load(configDir, envName) {
    let config = toUtil.deepCopy(this.DEF_CONFIG)

    this.loadDir(config, configDir, envName)

    this.adjustMultiConfig(config, 'database', this.DEF_CONFIG['database'])
    this.adjustMultiConfig(config, 'modules', this.DEF_CONFIG['modules'])
    this.adjustMultiConfig(config, 'workers', this.DEF_CONFIG['workers'])

    if (!config['log']['file']['filename']) {
      config['log']['file']['filename'] = './runtime/logs/' + config['appName'] + '.log'
    }

    if (!config['cache']['adapter']['file']['dir']) {
      config['cache']['adapter']['file']['dir'] = './runtime/cache/'
    }

    config['databaseMap'] = {}
    for (let db of config['database']) {
      config['databaseMap'][db['name']] = db
    }

    if (config['jwt']) {
      let jwtCfg = config['jwt']
      if (jwtCfg['enabled'] && !jwtCfg['secret']) {
        throw new Error('must specify "secret" option in jwt')
      }
      if (typeof jwtCfg['unless'] == 'function') jwtCfg['unless'] = { custom: jwtCfg['unless'] }
    }
    this.completeDatabase(config['modules'], config)
    this.completeDatabase(config['workers'], config)
    return config
  },
}

toUtil.deepFreeze(module.exports.DEF_CONFIG)
