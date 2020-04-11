'use strict'

const toUtil = require('./util')
const config = require('./config')
const Db = require('./db')
const log = require('./log')
const Cache = require('./cache')
const App = require('./app')
const { Response, RequestError } = require('./response')
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

  //绝对路径 默认当前工作目录 其他相当 ROOT_DIR 的相当路径可以使用 theone.path( other) 获取绝对路径
  ROOT_DIR: process.cwd(),
  //相对 ROOT_DIR 的路径
  CONFIG_DIR: './config',

  //可以指定自己的 Db类, 但必须继承至 require('theone-server').Db
  DB_CLASS: Db,

  DEBUG: true,
}

let initWaiting = undefined

//通常 theone 的属性都需要在 create() 之后才能正常使用
module.exports.Db = Db
module.exports.util = toUtil
module.exports.log = log
module.exports.config = {}
module.exports.env = {}
module.exports.Response = Response
module.exports.RequestError = RequestError

let caches = {} //存储通过字符串创建的 cache, 或 options 中有 name 属性的
module.exports.getCache = function (options, tag) {
  let name = ''
  if (typeof options == 'string') {
    name = options
    options = theone.config['cache']['adapter'][name]
    if (name == 'file') {
      options = Object.assign({}, options)
      options['dir'] = theone.path(options['dir'])
    }
  }
  if (name) {
    if (!toUtil.hasOwnPropertySafe(caches, name)) {
      caches[name] = Cache.createWrap(new Cache(options, theone.config['cache']['version']))
    }
    return tag ? caches[name].tag(tag) : caches[name]
  } else {
    let cache = Cache.createWrap(new Cache(options, theone.config['cache']['version']))
    return tag ? cache.tag(tag) : cache
  }
}

module.exports.path = function (...paths) {
  return path.join(this.env.ROOT_DIR, ...paths)
}

module.exports.pathNormalize = function (...paths) {
  let p = path.join(...paths)
  if (path.isAbsolute(p)) {
    return path.normalize(p)
  } else {
    return path.join(this.env.ROOT_DIR, p)
  }
}

module.exports.create = async function (environment = {}, init = () => {}) {
  if (initWaiting) throw new Error('Theone server has been initialized')
  if (environment.ENV_NAME == 'common') throw new Error('"common" is a reserved word and cannot be used as a ENV_NAME')

  initWaiting = toUtil.createWaiting()
  Object.freeze(Object.assign(this.env, defEnvironment, environment))
  global['theone'] = this //始终有 theone 全局对象
  if (typeof this.env.NAMESPACE == 'string' && this.env.NAMESPACE != 'theone') {
    global[this.env.NAMESPACE] = this
  }

  if (this.env.USE_INT && global['Int'] === undefined) global['Int'] = 'Int type' //定义一个名为 Int 的全局变量来支持 action 参数指定 Int 类型

  let cfg = config.load(this.path(this.env.CONFIG_DIR), this.env.ENV_NAME)
  toUtil.deepFreeze(Object.assign(this.config, cfg))
  log.init(this.config['log'], this.env.ROOT_DIR)

  this.cache = this.getCache(this.config['cache']['default'])

  if (this.env.DEBUG) {
    this.debug = require('./debug')
    await this.debug.start()
  }

  await init()
  this.app = new App()
  initWaiting.resolve()
  return this.app
}

module.exports.shutdown = async function () {
  if (!this.app) return

  await initWaiting
  await this.app.close()
  await Db.close()
  await log.shutdown()
  if (this.debug) await this.debug.close()
  for (const name in caches) {
    await caches[name].close()
  }

  this.app = undefined
  initWaiting = undefined
  this.cache = undefined
  this.config = {}
  this.env = {}
}
