'use strict'

module.exports = function () {
  return async function midC({ ctrl, action }, next) {
    ctrl.callMid = ctrl.callMid || []
    ctrl.callMid.push('midC')
    return next()
  }
}