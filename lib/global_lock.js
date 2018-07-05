'use strict'

/**
 * 锁定 global, 防止引入全局变量
 */
module.exports = function(globalNames = []) {
  if (!Array.isArray(globalNames)) {
    globalNames = []
  }
  //这里定义 可以使用的全局变量
  const globalDef = [

    '@@any-promise/REGISTRATION', //第三方模块中使用的全局变量
  ]

  for (let name of globalDef.concat(globalNames)) {
    if (!(name in global)) {
      global[name] = undefined
    }
  }

  Object.seal(global)
}