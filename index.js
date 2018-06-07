'use strict'

const toUtil = require('./lib/util')
const config = require('./lib/config')
const Db = require('./lib/db')
const log = require('./lib/log')
const App = require('./lib/app')
const path = require('path')

/*
  默认环境 (环境属性是比config的属性更基础, 启动服务器最初需要的属性, 如 config的路径等)
*/
const defEnvironment = {
  //可以提供一个命名空间, 会创建一个全局变量(等价于 require('theone-server').theone ).  禁用设置为 '' 
  NAMESPACE: 'theone',
  //是否锁定 global变量,  true:禁止添加全局变量
  GLOBAL_LOCK: true,


  //绝对路径 默认当前工作目录 其他相当 ROOT_DIR 的相当路径可以使用 theone.path( other) 获取绝对路径
  ROOT_DIR: process.cwd(),
  //相对 ROOT_DIR 的路径 
  CONFIG_DIR: './config',

  //可以指定自己的 Db类, 但必须继承至 require('theone-server').Db
  DB_CLASS: Db,

  DEBUG: true
}

let theoneApp = undefined

//通常 theone 的属性都需要在 create() 之后才能正常使用
module.exports.Db = Db
module.exports.util = toUtil
module.exports.log = log
module.exports.config = {}
module.exports.env = {}

module.exports.path = function(...paths) {
  return path.join(this.env.ROOT_DIR, ...paths)
}

module.exports.create = function(environment = {}) {
  if (theoneApp) {
    throw new Error('Theone server has been initialized')
  }
  Object.freeze(Object.assign(this.env, defEnvironment, environment))
  if (typeof this.env.NAMESPACE == 'string' && this.env.NAMESPACE != '') {
    global[this.env.NAMESPACE] = this
  }
  if (this.env.GLOBAL_LOCK) {
    require('./lib/global_lock')()
  }

  let cfg = config.load(this.path(this.env.CONFIG_DIR))
  toUtil.deepFreeze(Object.assign(this.config, cfg))
  log.init(this.config['log'], this.env.ROOT_DIR)

  let engine = this.env.DEBUG ? require('./lib/debug') : require('./lib/release')
  this.engine = new engine()
  this.engine.start()
  theoneApp = new App()
  
  return theoneApp
}

module.exports.shutdown = async function() {
  if (!theoneApp) {
    return
  }
  await theoneApp.close()
  await Db.close()
  await log.shutdown()
  await this.engine.close()
  theoneApp = undefined
  this.config = {}
  this.env = {}
}