'use strict'

const Koa = require('koa')
const compose = require('koa-compose')
const http = require('http')
const https = require('https')
const theone = require('..')
const util = require('util')
const fs = require('fs')
const path = require('path')
const bodyparser = require('koa-bodyparser')
const controller = require('../lib/controller')
const koa_static = require('koa-static')
const koa_jwt = require('koa-jwt')
const session = require('koa-session')

const _middlewares = Symbol('middlewares')
const _callback = Symbol('koa callback')

module.exports = class {
  constructor(...args) {
    this.koa = new Koa(...args)
    this.koa.errorHandlers = {}

    this[_middlewares] = []
    if (theone.config['staticDir'] !== false) {
      this.use(koa_static(theone.path(theone.config['staticDir'])))
    }
    this.use(controller.parsePath())
    this.use(bodyparser())

    if (theone.config['keys']) this.koa.keys = theone.config['keys']

    let jwtCfg = theone.config['jwt']
    if (jwtCfg && jwtCfg['enabled']) {
      let opts = Object.assign({}, jwtCfg)
      for (const name of ['enabled', 'unless', 'options']) delete opts[name]
      this.use(koa_jwt(opts).unless(Object.assign({}, jwtCfg['unless'])))
    }

    let sessionCfg = theone.config['session']
    if (sessionCfg && sessionCfg['enabled']) {
      this.use(session(Object.assign({}, sessionCfg), this.koa))
      if (sessionCfg['signed'] && !theone.config['keys']) {
        throw new Error('If the config["session"]["signed"] is "true", then config["keys"] must be configured')
      }
    }
  }

  async close() {
    let servers = []
    if (this.http) {
      servers.push(util.promisify(this.http.close.bind(this.http))())
    }
    if (this.https) {
      servers.push(util.promisify(this.https.close.bind(this.https))())
    }
    await Promise.all(servers)
    this.http = undefined
    this.https = undefined
  }

  loadMiddlewares(dir) {
    let files = fs.readdirSync(dir)
    let data = {}
    for (let file of files) {
      let filePath = path.join(dir, file)
      let stat = fs.statSync(filePath)
      if (file.endsWith('.js') && stat.isFile()) {
        let m = path.basename(filePath, '.js')
        data[m] = require(filePath)
      }
    }
    return data
  }

  registerMiddlewares() {
    let actionMid = async (obj, next) => {
      let ctrl = obj.ctrl
      let _middleware = ctrl.constructor._middleware
      if (_middleware) {
        return _middleware(obj, next)
      } else {
        return next()
      }
    }
    this.use(controller.callAction(actionMid))
    if (theone.env.DEBUG) {
      this.useBefore(async (ctx, next) => {
        return next().catch(e => {
          theone.log.debug('外部错误,请检查请求是否正确 ' + e.stack)
          throw e
        })
      })
    }
    this.koa.use(compose(this[_middlewares]))
    this[_callback] = this.koa.callback()
  }

  runHttp() {
    if (!theone.config['port']) throw new Error('http service is disabled')
    if (!this[_callback]) {
      this.registerMiddlewares()
    }
    this.http = http.createServer(this[_callback]).listen(theone.config['port'])
  }

  runHttps() {
    let httpsCfg = theone.config['https']
    if (!httpsCfg) throw new Error('https service is disabled')

    if (!this[_callback]) {
      this.registerMiddlewares()
    }
    if (httpsCfg['keyFilename'] && httpsCfg['certFilename']) {
      let options = {
        key: fs.readFileSync(theone.pathNormalize(httpsCfg['keyFilename'])),
        cert: fs.readFileSync(theone.pathNormalize(httpsCfg['certFilename']))
      }
      this.https = https.createServer(options, this[_callback]).listen(httpsCfg['port'])
    } else {
      this.https = https.createServer(this[_callback]).listen(httpsCfg['port'])
    }
  }

  checkServerStart(fn) {
    if (this[_callback]) {
      throw new Error('Must add middleware before server starts,  middleware:' + fn._name || fn.name || '-')
    }
  }

  use(middleware) {
    this.checkServerStart(middleware)
    this[_middlewares].push(middleware)
  }

  useBefore(middleware) {
    this.checkServerStart(middleware)
    this[_middlewares].unshift(middleware)
  }

  /**
   * 所有 handler 都会接受两个参数  ctx,  error   默认返回的 Status Code 已经设置在 ctx.response.status  上, 可通过 handler 修改
   * parsePath:  解析 path 阶段异常, 默认返回 404 或 500 错误
   * callAction: 执行 action 阶段异常, 默认返回 400 或 500 错误
   */
  setErrorHandlers(handlers = {}) {
    this.koa.errorHandlers = handlers
  }
}
