const { Worker } = require('worker_threads')

const toUtil = require('./util')
const config = require('./config')
const Db = require('./db')
const log = require('./log')
const Cache = require('./cache')
const App = require('./app')
const worker = require('./worker')
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
module.exports.workers = {}
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

module.exports._createEnv = async function (environment, workerName = 'main', instanceId = 0) {
  if (environment.ENV_NAME == 'common') throw new Error('"common" is a reserved word and cannot be used as a ENV_NAME')
  this.env.workerName = workerName
  this.env.workerInstId = instanceId
  Object.freeze(Object.assign(this.env, defEnvironment, environment))
  global['theone'] = this //始终有 theone 全局对象
  if (typeof this.env.NAMESPACE == 'string' && this.env.NAMESPACE != 'theone') {
    global[this.env.NAMESPACE] = this
  }

  //定义一个名为 Int 的全局变量来支持 action 参数指定 Int 类型
  if (this.env.USE_INT && global['Int'] === undefined) global['Int'] = 'Int type'

  let cfg = config.load(this.path(this.env.CONFIG_DIR), this.env.ENV_NAME)
  toUtil.deepFreeze(Object.assign(this.config, cfg))
  log.init(this.config['log'], this.env.ROOT_DIR)

  this.cache = this.getCache(this.config['cache']['default'])

  if (this.env.DEBUG) {
    this.debug = require('./debug')
    await this.debug.start()
  }
}

module.exports.create = async function (environment = {}, init = () => {}) {
  if (initWaiting) throw new Error('Theone server has been initialized')
  initWaiting = toUtil.createWaiting()
  await this._createEnv(environment)
  await init()
  this.app = new App()
  if (this.config['workers']) {
    for (const options of this.config['workers']) {
      if (!options.open) continue
      if (options.debug && this.env.DEBUG) {
        //debug 模式下将在主线程加载入口文件
        require(this.pathNormalize(options.filename))
        continue
      }
      if (toUtil.hasOwnPropertySafe(this.workers, options.name)) throw new Error('Worker name 重复：' + options.name)
      this.workers[options.name] = new Array(options.instances)
      for (let i = 0; i < options.instances; i++) {
        this.workers[options.name][i] = this.createWorker(environment, options, i, newWorker => {
          this.workers[options.name][i] = newWorker
        })
      }
    }
  }
  initWaiting.resolve()
  return this.app
}

module.exports.callWorkerAction = async function (path, args) {
  return worker.callAction(path, args)
}

module.exports.createWorker = function (environment, options, instanceId, onRestart) {
  let { name, entry, autorestart = true, heartbeat = 60 } = options
  let initScript = `
  const { parentPort } = require('worker_threads')
  const theone = require(${JSON.stringify(__filename)})
  const environment = ${JSON.stringify(environment)}
  theone._createEnv( environment, '${name}', ${instanceId}).then(
    require(${JSON.stringify(this.pathNormalize(entry))})
  )
  setInterval(()=>{
    parentPort.postMessage('heartbeat')
  }, ${heartbeat * 1000})
  `

  let worker = new Worker(initScript, { eval: true, workerData: { options, instanceId } })
  worker._lastHeartbeat = Date.now()
  worker._heartbeatTick = setInterval(() => {
    if (Date.now() - worker._lastHeartbeat > 2 * heartbeat * 1000) {
      this.log.error('[worker:%s-%d] 心跳检查超时，将重启 worker 线程', name, instanceId)
      worker.terminate()
    }
  }, 2 * heartbeat * 1000)

  worker.on('message', message => {
    if (message != 'heartbeat') return
    worker._lastHeartbeat = Date.now()
  })

  worker.on('error', error => {
    this.log.error('[worker:%s-%d] %s', name, instanceId, error)
  })

  if (autorestart) {
    worker.on('exit', exitCode => {
      clearInterval(worker._heartbeatTick)
      worker._heartbeatTick = undefined
      if (!this._shutdown && exitCode != 0 && !worker._isRestart) {
        let newWorker = this.createWorker(environment, options, instanceId, onRestart)
        worker._isRestart = true
        this.log.error('[worker:%s-%d] worker 线程自动重启', name, instanceId)
        if (onRestart) onRestart(newWorker)
      }
    })
  }
  return worker
}

module.exports.shutdown = async function () {
  if (!initWaiting) return
  await initWaiting
  this._shutdown = true
  if (this.app) {
    await this.app.close()
    this.app = undefined
  }
  for (const name in this.workers) {
    for (const instance of this.workers[name]) {
      await instance.terminate()
    }
    delete this.workers[name]
  }
  await Db.close()
  await log.shutdown()
  if (this.debug) await this.debug.close()
  for (const name in caches) {
    await caches[name].close()
  }
  this._shutdown = false
  initWaiting = undefined
  this.cache = undefined
  this.config = {}
  this.env = {}
}

process.on('unhandledRejection', error => {
  if (theone && theone.log && theone.log.error) {
    theone.log.error('UnhandledRejection\n%s', error.stack)
  } else {
    // eslint-disable-next-line no-console
    console.error('UnhandledRejection\n%s', error.stack)
  }
})
