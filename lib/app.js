'use strict'

const Koa = require('koa')
const compose = require('koa-compose')
const http = require('http')
const https = require('https')
const theone = require('..')
const util = require('util')
const fs = require('fs')
const bodyparser = require('koa-bodyparser')
const controller = require('../lib/controller')

const _middlewares = Symbol('middlewares')
const _actionMiddlewares = Symbol('action middlewares')
const _callback = Symbol('koa callback')

module.exports = class {
  constructor(...args) {
    this.koa = new Koa(...args)
    this[_middlewares] = []
    this[_actionMiddlewares] = []

    this.use(bodyparser())
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

  registerMiddlewares() {
    if (this[_actionMiddlewares].lenght > 0) {
      this.use(controller.callActions(compose(this[_actionMiddlewares])))
    } else {
      this.use(controller.callActions())
    }
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
    this.checkServerStart()
    this[_middlewares].push(middleware)
  }

  useBefore(middleware) {
    this.checkServerStart()
    this[_middlewares].unshift(middleware)
  }

  actionUse(middleware) {
    this.checkServerStart()
    this[_actionMiddlewares].push(middleware)
  }

  actionUseBefore(middleware) {
    this.checkServerStart()
    this[_actionMiddlewares].unshift(middleware)
  }
}