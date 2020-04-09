
class Response {
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

//有外部请求错误引起的异常，只记录 debug 日志， （其他异常会记录 error 日志）
class RequestError extends Error {

}

module.exports = {
  Response,
  RequestError
}
