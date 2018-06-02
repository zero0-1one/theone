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

  //只有 ROOT_DIR 是绝对路径, 其他所有 路径配置都是相对 ROOT_DIR 的路径 使用 theone.path( other)
  //默认当前工作目录
  ROOT_DIR: process.cwd(),
  CONFIG_DIR: './config',

  //可以指定自己的 Db类, 但必须继承至 require('theone-server').Db
  DB_CLASS: Db,

  DEBUG: true
}

let theoneApp = undefined

//通常 theone 的属性都需要在 create() 之后才能正常使用
module.exports = {
  create(environment = {}) {
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
    this.engine = this.env.DEBUG ? require('./lib/debug') : require('./lib/release')
    let cfg = config.load(this.path(this.env.CONFIG_DIR))
    toUtil.deepFreeze(Object.assign(this.config, cfg))
    log.init(this.config['log'])
    this.engine.start()
    theoneApp = new App()
    return theoneApp
  },

  async shutdown() {
    if (!theoneApp) {
      return
    }
    await theoneApp.close()
    await Db.close()
    await log.shutdown()
    await this.engine.stop()
    theoneApp = undefined
    this.config = {}
    this.env = {}
  },

  path(...paths) {
    return path.join(this.env.ROOT_DIR, ...paths)
  },

  Db,
  toUtil,
  log,

  config: {},
  env: {},
}