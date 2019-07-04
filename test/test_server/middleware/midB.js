'use strict'

module.exports = function () {
  return async function midB({ ctrl, action }, next) {
    ctrl.callMid = ctrl.callMid || []
    ctrl.callMid.push('midB')
    return next()
  }
}