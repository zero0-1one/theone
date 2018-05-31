'use strict'


const controller = require('./controller')

module.exports = function(apiDir, actionSuffix, multiVersion) {
  let allActions = controller.load()
  return async (ctx, next) => {
    let { common, actions } = ctx.request.body
    for (let [actionName, args] of actions) {
      //...................
    }
    await next()
  }
}