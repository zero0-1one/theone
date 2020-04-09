const crypto = require('crypto')
const path = require('path')

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

  //深度赋值  pathMode b如:  {'a.b.c':1} 深度赋值 {a:{b:{c:1}}}  不存在则会创建对应 Object(但不会创建数组)
  //数组可以使用  a.0.c  赋值, 但当 a 不存在时候创建的是 Object, 而不是 Array.  (因为数字可能会很大)
  deepAssign(target, source, pathMode = true) {
    let pathData = []
    for (const [k, v] of Object.entries(source)) {
      if (pathMode && k.includes('.')) {
        pathData.push([k, v])
        continue
      }
      if (v && !Array.isArray(v) && typeof v == 'object' && !Array.isArray(target[k]) && typeof target[k] == 'object') {
        this.deepAssign(target[k], v)
      } else {
        target[k] = v
      }
    }
    for (const [path, value] of pathData) {
      let names = path.split('.')
      names = names.map(v => v.trim())
      let temp = target
      for (let i = 0; i < names.length - 1; i++) {
        if (names[i] in temp) {
          temp = temp[names[i]]
        } else {
          temp[names[i]] = temp = {}
        }
      }
      let field = names.pop()
      temp[field] = value
    }
    return target
  },

  //适用于 只包含基本类型属性的obj
  deepCopy(obj, reserveTypes = ['function']) {
    let type = typeof obj
    if (reserveTypes.includes(type)) return obj
    if (obj === undefined || obj === null || type == 'string' || type == 'number' || type == 'boolean') {
      return obj
    } else if (Array.isArray(obj)) {
      let a = new Array(obj.length)
      obj.forEach((v, i) => a[i] = v)  // 使用 forEach 不使用 for of! 防止拷贝只设置了 length 的'空'数组
      return a
    } else if (type == 'object') {
      let copy = {}
      for (const key in obj) {
        copy[key] = this.deepCopy(obj[key])
      }
      return copy
    } else {
      throw new TypeError('未实现的copy类型: ' + type)
    }
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
    let total = ''
    while (n > 0) {
      if (n % 2 == 1) total += s
      if (n == 1) break
      s += s
      n = n >> 1
    }
    return total
  },

  md5(str, encoding = 'hex') {
    let hash = crypto.createHash('md5')
    hash.update(str)
    return hash.digest(encoding)
  },

  sha1(str, encoding = 'hex') {
    let hash = crypto.createHash('sha1')
    hash.update(str)
    return hash.digest(encoding)
  },

  hmac(str, key, algorithm = 'sha256', encoding = 'hex') {
    let hmac = crypto.createHmac(algorithm, key)
    hmac.update(str)
    return hmac.digest(encoding)
  },

  passwordHash(password, algorithm = 'sha256', key = '') {
    key = key || this.randomStr(6)
    return '#zo-pwd|' + algorithm + '|' + key + '|' + this.hmac(password, key, algorithm, 'base64')
  },

  passwordVerify(password, passwordHash) {
    if (!passwordHash.startsWith('#zo-pwd|')) throw new Error('不是zo-pwd类型的密码')
    let data = passwordHash.split('|')
    return this.passwordHash(password, data[1], data[2]) === passwordHash
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
      if (owner[name] === self) delete owner[name]
      self.resolve() //总是 resolve
    }
  },

  getStack() {
    let original = Error.prepareStackTrace
    Error.prepareStackTrace = (_, stack) => stack
    let err = new Error()
    let stack = err.stack
    Error.prepareStackTrace = original
    stack.shift() // remove 自身 
    stack.shift() // 删除 调用者
    return stack
  },

  replaceModule(name, cb) {
    let stack = this.getStack()
    let dir = path.dirname(stack[0].getFileName())
    if (!path.isAbsolute(name)) {
      name = path.join(dir, name)
    }
    let resolve = require.resolve(name)
    delete require.cache[resolve] //清空就的

    let newModule = cb(require(resolve))
    require.cache[resolve].exports = newModule //替换缓存
    return newModule
  }
}
