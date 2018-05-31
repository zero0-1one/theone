'use strict'

const Koa = require('koa')
const http = require('http')
const https = require('https')
const theone = require('..')
const util = require('util')


module.exports = class extends Koa {
  constructor(...args) {
    super(...args)
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
    this.http = http.createServer(this.callback()).listen(theone.config['port'])
  }

  runHttps() {
    this.https = https.createServer(this.callback()).listen(theone.config['httpsPort'])
  }
}