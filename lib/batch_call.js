'use strict'


const controller = require('./controller')

module.exports = function() {
  controller.load()
  return async function batchCall(ctx, next) {
    let { common, actions } = ctx.request.body
    let results = []
    for (let [moduleName, actionPath, args] of actions) {
      try {
        let rt = await controller.callAction(moduleName, actionPath, args, common['version'])
        results.push(rt)
      } catch (e) {
        results.push(e.message)
        args
      }
    }
    await next()
  }
}