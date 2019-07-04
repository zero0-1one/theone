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
const session = require('koa-session')

const _middlewares = Symbol('middlewares')
const _callback = Symbol('koa callback')

module.exports = class {
  constructor(...args) {
    this.koa = new Koa(...args)
    this[_middlewares] = []
    if (theone.config['staticDir'] !== false) {
      this.use(koa_static(theone.path(theone.config['staticDir'])))
    }
    this.use(bodyparser())
    this.use(session(Object.assign({}, theone.config['session']), this.koa))
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
      if (typeof ctrl.constructor.middleware == 'function') {
        let _middleware = ctrl.constructor._middleware
        if (_middleware) {
          return _middleware(obj, next)
        } else {
          return next()
        }
      }
    }
    this.use(controller.callAction(actionMid))
    this.koa.use(compose(this[_middlewares]))
    this[_callback] = this.koa.callback()
  }

  runHttp() {
    if (!this[_callback]) {
      this.registerMiddlewares()
    }
    this.http = http.createServer(this[_callback]).listen(theone.config['port'])
  }

  runHttps() {
    if (!this[_callback]) {
      this.registerMiddlewares()
    }
    let httpsCfg = theone.config['https']
    if (httpsCfg['keyFilename'] && httpsCfg['certFilename']) {
      let options = {
        key: fs.readFileSync(httpsCfg['keyFilename']),
        cert: fs.readFileSync(httpsCfg['certFilename'])
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
}