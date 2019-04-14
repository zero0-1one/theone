'use strict'
/**
 * 当 theone.env.DEBUG 为 false 时 加载此模块, 否则加载 debug 模块
 */

const common = require('./common')
const theone = require('..')

module.exports = class extends common {
  async start() {

  }

  async close() {

  }
}