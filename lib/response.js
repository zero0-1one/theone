'use strict'

module.exports = class Response {
  constructor(data, status = 'succeed') {
    this.data = data
    this.status = status
  }

  isFailed() {
    return this.status == 'failed'
  }

  isError() {
    return this.status != 'succeed' && this.status != 'failed'
  }

  isSucceed() {
    return this.status == 'succeed'
  }

  send(ctx) {
    if (typeof this.data == 'function') {
      this.data(ctx)
    } else {
      ctx.body = this.data
    }
  }
}