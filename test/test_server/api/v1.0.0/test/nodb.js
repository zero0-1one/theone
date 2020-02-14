'use strict'

module.exports = class {
  succeedAction() {
    return 'succeed'
  }

  failedAction() {
    console.log('failedAction')
    return this.failed('failed')
  }

  errorAction() {
    return this.error('error')
  }


  throwAction() {
    throw new Error('error')
  }
}