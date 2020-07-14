'use strict'
const Client = require('zo-theone-client')
module.exports = class TestClient {
  constructor(version, moduleName) {
    let url = 'http://localhost:8080/'
    if (moduleName) url += moduleName + '/'
    if (version) url += version + '/'
    this.client = new Client({
      url,
      request: 'request',
      hooks: {
        async results({ error, res }) {
          if (error) return new Error('请求异常' + error)
          if (res.statusCode == 200) return res.data
          return new Error('请求错误  statusCode:' + res.statusCode)
        }
      }
    })
  }

  async get(...args) {
    return this.client.get(...args)
  }

  async post(...args) {
    return this.client.post(...args)
  }
}