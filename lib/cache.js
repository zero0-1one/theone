'use strict'

const fs = require('fs')
const fsPromises = fs.promises
const path = require('path')
const crypto = require('crypto')
const toUtil = require('./util')

let cacheOptions = undefined
let cacheLogger = undefined
let cacheCacher = undefined
let cacheGcInterval = undefined
let cacheLocks = {}

//内置的 file cacher
let fileCacher = {
  _gcing: false,

  key(name) {
    let sha1 = crypto.createHash('sha1')
    sha1.update(name)
    return sha1.digest('hex')
  },

  _mkdirs(dirpath) {
    if (!fs.existsSync(dirpath)) {
      this._mkdirs(path.dirname(dirpath))
      fs.mkdirSync(dirpath)
    }
  },

  init(isExpired) {
    this._mkdirs(cacheOptions['dir'])
    for (let d of '0123456789abcdef') {
      for (let d2 of '0123456789abcdef') {
        let dirPath = path.join(cacheOptions['dir'], d + d2)
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath)
        }
      }
    }
    this._gcSync(isExpired)
  },

  async clear(name) {
    let key = this.key(name)
    await fsPromises.unlink(path.join(cacheOptions['dir'], key.substring(0, 2), key + '.json'))
  },

  async get(name) {
    let key = this.key(name)
    let str = await fsPromises.readFile(path.join(cacheOptions['dir'], key.substring(0, 2), key + '.json'), 'utf8')
    return JSON.parse(str)
  },

  async set(name, data) {
    let key = this.key(name)
    await fsPromises.writeFile(path.join(cacheOptions['dir'], key.substring(0, 2), key + '.json'), JSON.stringify(data))
  },

  async gc(isExpired) {
    if (this._gcing) return
    this._gcing = true
    try {
      for (let d of '0123456789abcdef') {
        for (let d2 of '0123456789abcdef') {
          let dirPath = path.join(cacheOptions['dir'], d + d2)
          let files = await fsPromises.readdir(dirPath)
          for (let file of files) {
            try {
              let filePath = path.join(dirPath, file)
              if (!(await fsPromises.stat(filePath)).isFile()) continue
              let str = await fsPromises.readFile(filePath, 'utf8')
              let data = JSON.parse(str)
              if (isExpired(data)) await fsPromises.unlink(filePath)
            } catch (e) { }
          }
        }
      }
    } finally {
      this._gcing = false
    }
  },

  _gcSync(isExpired) {
    for (let d of '0123456789abcdef') {
      for (let d2 of '0123456789abcdef') {
        let dirPath = path.join(cacheOptions['dir'], d + d2)
        let files = fs.readdirSync(dirPath)
        for (let file of files) {
          try {
            let filePath = path.join(dirPath, file)
            if (!fs.statSync(filePath).isFile()) continue
            let str = fs.readFileSync(filePath, 'utf8')
            let data = JSON.parse(str)
            if (isExpired(data)) fs.unlinkSync(filePath)
          } catch (e) { }
        }
      }
    }
  }
}

//value 为 undefined 等价与 cache.get()
//value 为 null 等价于 cache.clear()
//value 为 function 等价与 cache.remember()  只有当cache不存在的时候设置
//value 为 其他值  等价与 cache.set()  总是设置
let cache = async function (name, value, timeout) {
  if (value === undefined) {
    return cache.get(name)
  } else if (value === null) {
    return cache.clear(name)
  } else if (typeof value == 'function') {
    return cache.rememver(name, value, timeout)
  } else {
    return cache.set(name, value, timeout)
  }
}

function isExpired(data) {
  return data.expire != 0 && data.expire < Date.now()
}

cache.init = function (options, rootDir = './', logger = function () { }, cacher = fileCacher) {
  cache.close()
  cacheOptions = toUtil.deepCopy(options)
  cacheOptions['dir'] = path.join(rootDir, options['dir'])
  cacheLogger = logger
  cacheCacher = cacher
  cacheCacher.init(isExpired)
  cacheGcInterval = setInterval(() => {
    cacheCacher.gc(isExpired)
  }, options['gcInterval'] * 1000)
}

cache.close = function () {
  if (cacheGcInterval) {
    clearInterval(cacheGcInterval)
    cacheGcInterval = undefined
  }
}

cache.get = async function (name) {
  return toUtil.doOrder(name, cacheLocks, async () => {
    let data = await cacheCacher.get(name).catch(() => { })
    if (data !== undefined && !isExpired(data)) {
      return data.value
    }
  })
}

cache.clear = async function (name) {
  return toUtil.doOrder(name, cacheLocks, async () => {
    await cacheCacher.clear(name).catch(() => { })
  })
}

cache._data = function (value, timeout) {
  if (timeout === undefined || timeout === null) {
    timeout = cacheOptions['timeout']
  }
  let expire = timeout == 0 ? 0 : Date.now() + timeout * 1000
  return { value, expire }
}

cache.rememver = async function (name, valueFunc, timeout) {
  return toUtil.doOrder(name, cacheLocks, async () => {
    let data = await cacheCacher.get(name).catch(() => { })
    if (data !== undefined && !isExpired(data)) {
      return data.value
    }
    let value = await valueFunc()
    await cacheCacher.set(name, cache._data(value, timeout)).catch(e => {
      cacheLogger('Failed to set cache "%s", msg:"%s" , value: %s', name, e.message, value.toString())
    })
    return value
  })
}

cache.set = async function (name, value, timeout) {
  return toUtil.doOrder(name, cacheLocks, async () => {
    await cacheCacher.set(name, cache._data(value, timeout)).catch(e => {
      cacheLogger('Failed to set cache "%s", msg:"%s" , value: %s', name, e.message, value.toString())
    })
    return value
  })
}

cache.fileCacher = fileCacher
module.exports = cache
