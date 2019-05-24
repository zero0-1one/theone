'use strict'
const request = require('request')

module.exports = class {

  constructor(url, module = '', version = '') {
    this.url = url
    this.module = module
    this.version = version
    this.jar = request.jar()
    this._request = request.defaults({ jar: this.jar })
  }

  async request(type, action, args = {}, headers = {}, module = '') {
    let url = ''
    module = module || this.module
    if (this.version) {
      url = `${this.url}/${module}/${this.version}/${action}`
    } else {
      url = `${this.url}/${module}/${action}`
    }
    let options = {
      url,
      method: type.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(args)
    }

    Object.assign(options.headers, headers)

    return new Promise((resolve, reject) => {
      this._request(options, (error, response, body) => {
        if (error) {
          reject(error)
          return
        }
        if (response.statusCode == 200) {
          resolve(JSON.parse(body))
        }
      })
    })
  }

  async get(...args) {
    return this.request('GET', ...args)
  }

  async post(...args) {
    return this.request('POST', ...args)
  }

  clearCookies() {
    this.jar = request.jar()
    this._request = request.defaults({ jar: this.jar })
  }
}