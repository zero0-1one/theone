'use strict'

module.exports = class {
  succeedAction() {
    return 'succeed'
  }

  failedAction() {
    return this.failed('failed')
  }

  errorAction() {
    return this.error(-2, 'error')
  }


  throwAction() {
    throw new Error('error')
  }
}