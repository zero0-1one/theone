'use strict'
const toUtil = require('./util')
const request = require('request')

module.exports = class {

  constructor(url, module = '', version = '', commonFunc) {
    this.url = url
    this.module = module
    this.version = version
    this.actions = []
    this.calling = undefined
    if (commonFunc) {
      this.commonFunc = () => {
        let common = commonFunc()
        common['version'] = version
        return common
      }
    } else {
      this.commonFunc = () => {
        return version ? { version } : {}
      }
    }
    this.jar = request.jar()
    this._request = request.defaults({ jar: this.jar })
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

  clearCookies() {
    this.jar = request.jar()
    this._request = request.defaults({ jar: this.jar })
  }

  _batchCall() {
    let options = {
      url: this.url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ actions: this.actions, common: this.commonFunc() })
    }
    let calling = this.calling
    this.actions = []
    this.calling = undefined

    this._request(options, (error, response, body) => {
      if (error) {
        calling.reject(error)
        return
      }
      calling.resolve(JSON.parse(body))
    })
  }

}