
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
    let type = typeof this.data
    if (type == 'function') {
      this.data(ctx)
    } else {
      ctx.response.set('Content-Type', 'application/json')
      ctx.body = type == 'object' ? this.data : JSON.stringify(this.data)
    }
  }
}

