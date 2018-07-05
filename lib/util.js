'use strict'


let locks = {}
module.exports = {

  //深度冻结
  deepFreeze(obj) {
    if (!obj) { return obj }
    Object.freeze(obj)
    let propNames = Object.getOwnPropertyNames(obj)
    propNames.forEach(name => {
      let prop = obj[name]
      if (typeof prop == 'object' && prop !== null && !Object.isFrozen(prop)) { //Object.isFrozen(prop) 防止obj循环引用，导致死循环
        this.deepFreeze(prop)
      }
    })
    return obj
  },

  //深度赋值
  deepAssign(target, ...sources) {
    if (sources.length == 1) {
      for (let [k, v] of Object.entries(sources[0])) {
        if (!Array.isArray(v) && typeof v == 'object' &&
          !Array.isArray(target[k]) && typeof target[k] == 'object') {
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
  }
}