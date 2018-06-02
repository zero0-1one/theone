'use strict'

const Koa = require('koa')
const http = require('http')
const https = require('https')
const theone = require('..')
const util = require('util')
const fs = require('fs')
const bodyparser = require('koa-bodyparser')
const batchCall = require('../lib/batch_call')


module.exports = class {
  constructor(...args) {
    this.koa = new Koa(...args)
    this._middlewares = []
    this._actionMiddlewares = []
    
    this.useAfter(bodyparser())
    this.useAfter(batchCall())
  }

  async close() {
    let servers = []
    if (this.http) {
      servers.push(util.promisify(this.http.close)())
    }
    if (this.https) {
      servers.push(util.promisify(this.https.close)())
    }
    await Promise.all(servers)
  }

  runHttp() {
    this.http = http.createServer(this.koa.callback()).listen(theone.config['port'])
  }

  runHttps() {
    let httpsCfg = theone.config['https']
    if (httpsCfg['keyFilename'] && httpsCfg['certFilename']) {
      let options = {
        key: fs.readFileSync(httpsCfg['keyFilename']),
        cert: fs.readFileSync(httpsCfg['certFilename'])
      }
      this.https = https.createServer(options, this.koa.callback()).listen(httpsCfg['port'])
    } else {
      this.https = https.createServer(this.koa.callback()).listen(httpsCfg['port'])
    }
  }

  useBefore(middleware) {
    this._middlewares.unshift(middleware)
  }

  useAfter(middleware) {
    this._middlewares.push(middleware)
  }

  useBeforeAction(middleware) {
    this._actionMiddlewares.unshift(middleware)
  }

  useAfterAction(middleware) {
    this._actionMiddlewares.push(middleware)
  }
}