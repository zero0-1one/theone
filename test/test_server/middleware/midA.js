'use strict'

module.exports = function () {
  return async function midA({ ctrl, action }, next) {
    ctrl.callMid = ctrl.callMid || []
    ctrl.callMid.push('midA')
    return next()
  }
}