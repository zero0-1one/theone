'use strict'

const crypto = require('crypto')

let locks = {}
module.exports = {
  //深度冻结
  deepFreeze(obj) {
    if (!obj) {
      return obj
    }
    Object.freeze(obj)
    let propNames = Object.getOwnPropertyNames(obj)
    propNames.forEach(name => {
      let prop = obj[name]
      if (typeof prop == 'object' && prop !== null && !Object.isFrozen(prop)) {
        //Object.isFrozen(prop) 防止obj循环引用，导致死循环
        this.deepFreeze(prop)
      }
    })
    return obj
  },

  //深度赋值
  deepAssign(target, ...sources) {
    if (sources.length == 1) {
      for (let [k, v] of Object.entries(sources[0])) {
        if (v && !Array.isArray(v) && typeof v == 'object' && !Array.isArray(target[k]) && typeof target[k] == 'object') {
          this.deepAssign(target[k], v)
        } else {
          target[k] = v
        }
      }
      return target
    }
    for (let v of sources) {
      this.deepAssign(target, v)
    }
    return target
  },

  //适用于 只包含基本类型属性的obj
  deepCopy(obj) {
    if (typeof obj != 'object') {
      return obj
    }
    return JSON.parse(JSON.stringify(obj))
  },

  //随机 [min, max] 区间内的整数
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },

  randomStr(len, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let str = ''
    for (let i = 0; i < len; i++) {
      str += chars.charAt(this.randomInt(0, chars.length - 1))
    }
    return str
  },

  //高效的二分法重复字符串
  repeatStr(target, n) {
    let s = target
    let total = ""
    while (n > 0) {
      if (n % 2 == 1) total += s
      if (n == 1) break
      s += s
      n = n >> 1
    }
    return total
  },

  passwordHash(password, hashType = 'sha1', salt = '') {
    salt = salt || this.randomStr(6)
    let hash = crypto.createHash(hashType)
    hash.update(salt + password)
    return hashType + '|' + salt + '|' + hash.digest('base64')
  },

  passwordVerify(password, passwordHash) {
    let data = passwordHash.split('|')
    return this.passwordHash(password, data[0], data[1]) == passwordHash
  },

  createWaiting() {
    let refResolve
    let refReject
    let waiting = new Promise((resolve, reject) => {
      refResolve = resolve
      refReject = reject
    })
    waiting.resolve = refResolve
    waiting.reject = refReject
    return waiting
  },

  async sleep(time) {
    return new Promise(resolve => {
      setTimeout(resolve, time)
    })
  },

  /**
   * 最好使用 doOrder
   */
  async lock(name, cb, owner) {
    if (owner == undefined) {
      owner = locks
    }
    while (owner.hasOwnProperty(name)) {
      await owner[name]
    }
    owner[name] = this.createWaiting()
    return cb().finally(() => {
      owner[name].resolve()
      delete owner[name]
    })
  },

  async doOrder(name, owner, cb) {
    if (typeof name != 'string' || name == '' || typeof owner != 'object') throw '必须指定 name 和 owner'
    let wait = null
    let self = this.createWaiting()
    if (owner[name]) {
      wait = owner[name]
    }
    owner[name] = self //更新最后一个任务
    try {
      if (wait) await wait
      return await cb()
    } finally {
      self.resolve() //总是 resolve
      if (owner[name] === self) owner[name] = undefined
    }
  }
}
