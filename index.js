'use strict'

const toUtil = require('./lib/util')
const config = require('./lib/config')
const Db = require('./lib/db')
const log = require('./lib/log')
const cache = require('./lib/cache')
const App = require('./lib/app')
const Response = require('./lib/response')
const path = require('path')

/*
  默认环境 (环境属性是比config的属性更基础, 启动服务器最初需要的属性, 如 config的路径等)
*/
const defEnvironment = {
  //决定多配置表使用哪一个
  ENV_NAME: '',

  //是否启用在Action参数 类型标记语法中启用 'Int' 变量类型， 如果启用会引入一个全局变量 'Int'
  USE_INT: true,

  //可以提供一个额外的命名空间, 会创建一个 require('zo-theone') 引用的全局变量.
  NAMESPACE: 'theone',
  //是否锁定 global变量,  true:禁止添加全局变量,  如果为数组则指定允许的全局变量
  GLOBAL_LOCK: true,
  //禁用 eval 方法
  DISABLE_EVAL: true,

  //绝对路径 默认当前工作目录 其他相当 ROOT_DIR 的相当路径可以使用 theone.path( other) 获取绝对路径
  ROOT_DIR: process.cwd(),
  //相对 ROOT_DIR 的路径
  CONFIG_DIR: './config',

  //可以指定自己的 Db类, 但必须继承至 require('theone-server').Db
  DB_CLASS: Db,

  //可以指定自己的 CACHER 对象(默认使用内置的 fileCacher),
  //需要拥有 init, clear, get, set, gc 方法, 原型如下:
  // init(isExpired)
  // async clear(name)
  // async get(name)
  // async set(name, data)
  // async gc(isExpired)
  CACHER: cache.fileCacher,

  DEBUG: true
}

let initWaiting = undefined

//通常 theone 的属性都需要在 create() 之后才能正常使用
module.exports.Db = Db
module.exports.util = toUtil
module.exports.log = log
module.exports.cache = cache
module.exports.config = {}
module.exports.env = {}
module.exports.Response = Response

module.exports.path = function (...paths) {
  return path.join(this.env.ROOT_DIR, ...paths)
}

module.exports.pathNormalize = function (p) {
  if (path.isAbsolute(p)) {
    return path.normalize(p)
  } else {
    return path.join(this.env.ROOT_DIR, p)
  }
}

module.exports.create = async function (environment = {}, init = () => { }) {
  if (initWaiting) throw new Error('Theone server has been initialized')
  if (environment.ENV_NAME == 'common') throw new Error('"common" is a reserved word and cannot be used as a ENV_NAME')

  initWaiting = toUtil.createWaiting()
  Object.freeze(Object.assign(this.env, defEnvironment, environment))
  global['theone'] = this //始终有 theone 全局对象
  if (typeof this.env.NAMESPACE == 'string' && this.env.NAMESPACE != 'theone') {
    global[this.env.NAMESPACE] = this
  }

  if (this.env.USE_INT && global['Int'] === undefined) global['Int'] = 'Int type' //定义一个名为 Int 的全局变量来支持 action 参数指定 Int 类型

  if (this.env.DISABLE_EVAL) {
    delete global['eval']
    // delete global['Function']   //暂时还没有很好的方法禁用 new Function
  }

  // GLOBAL_LOCK: ['wordLib'],
  if (this.env.GLOBAL_LOCK) {
    require('./lib/global_lock')(this.env.GLOBAL_LOCK)
  }

  let cfg = config.load(this.path(this.env.CONFIG_DIR), this.env.ENV_NAME)
  toUtil.deepFreeze(Object.assign(this.config, cfg))
  log.init(this.config['log'], this.env.ROOT_DIR)
  cache.init(this.config['cache'], this.env.ROOT_DIR, log.error, this.env.CACHER)

  let engine = this.env.DEBUG ? require('./lib/debug') : require('./lib/release')
  this.engine = new engine()
  await this.engine.start()
  await init()
  theone.app = new App()
  initWaiting.resolve()
  theone.app = theone.app
  return theone.app
}

module.exports.shutdown = async function () {
  if (!theone.app) {
    return
  }
  await this.initWaiting
  await theone.app.close()
  await Db.close()
  await log.shutdown()
  await this.engine.close()
  await cache.close()
  theone.app = undefined
  this.initWaiting = undefined
  this.config = {}
  this.env = {}
}
