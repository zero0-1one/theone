'use strict'

module.exports = class {
  succeed_Action() {
    return 'succeed'
  }

  failed_Action() {
    console.log('failedAction')
    return this.failed('failed')
  }

  error_Action() {
    return this.error('error')
  }


  throw_Action() {
    throw new Error('error')
  }

  paramInt_Action(arg = Int) {
    return arg
  }

  paramString_Action(arg = String) {
    return arg
  }

  paramBoolean_Action(arg = Boolean) {
    return arg
  }

  paramDate_Action(arg = Date) {
    return arg
  }
}