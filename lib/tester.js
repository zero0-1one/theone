'use strict'
const toUtil = require('./util')
const http = require('http')
const https = require('https')
const { URL } = require('url')


module.exports = class {

  constructor(url, module = '', version = '', commonFunc) {
    url = new URL(url)
    this.protocol = url.protocol == 'https' ? https : http
    this.host = url.hostname
    this.port = url.port
    this.module = module
    this.version = version
    this.actions = []
    this.calling = undefined
    this.commonFunc = commonFunc || function() {
      return version ? { version } : {}
    }
  }

  async request(action, args = {}, module = '') {
    let index = this.actions.length
    this.actions.push([module || this.module, action, args])
    if (index == 0) {
      this.calling = toUtil.createWaiting()
      process.nextTick(() => {
        this._batchCall()
      })
    }
    return (await this.calling)[index]
  }

  async call(...args) {
    return (await this.request(...args)).data
  }


  _batchCall() {
    let postData = { actions: this.actions, common: this.commonFunc() }
    let calling = this.calling
    this.actions = []
    this.calling = undefined

    let options = {
      hostname: this.host,
      port: this.port,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }

    let data = []
    let req = this.protocol.request(options, (res) => {
      res.setEncoding('utf8')
      res.on('data', function(chunk) {
        data.push(chunk)
      })
      res.on('end', function() {
        let results = JSON.parse(data.join(''))
        calling.resolve(results)
      })
    })

    req.on('error', (e) => {
      calling.reject(e)
    })

    req.write(JSON.stringify(postData))
    req.end()
  }

}