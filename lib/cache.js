const toUtil = require('./util')
const schedule = require('node-schedule')

class Cache {
  constructor(options, version = 0) {
    if (this.adapter) throw new Error('this cache has been initialized')
    this.adapter = new options['Adapter'](options)
    this.options = options
    this.version = version
    this._locks = {}
    this._tagLocks = {}
    this._tags = {}
    if (options['gcSchedule']) {
      this.gcJob = schedule.scheduleJob(options['gcSchedule'], () => {
        this.adapter.gc(this._isExpired)
      })
    }
  }

  getLocks(tag) {
    if (!tag) return this._locks
    return this._tagLocks[tag] = this._tagLocks[tag] || {}
  }

  close() {
    if (this.gcJob) {
      this.gcJob.cancel()
      this.gcJob = undefined
    }
  }

  async get(name, tag) {
    return toUtil.doOrder(name, this.getLocks(tag), async () => {
      let data = await this.adapter.get(name, tag).catch(() => { }) //允许失败
      if (data !== undefined && !this._isExpired(data)) {
        return data.value
      }
    })
  }

  async clear(name, tag) {
    return toUtil.doOrder(name, this.getLocks(tag), async () => {
      await this.adapter.clear(name, tag)
    })
  }

  async clearTag(tag) {
    await this.adapter.clearTag(tag)
  }

  _data(value, timeout) {
    if (timeout === undefined || timeout === null) {
      timeout = this.options['timeout']
    }
    let expired = timeout == 0 ? 0 : Math.floor(Date.now() + timeout * 1000) // 单位: ms

    return { value, expired, v: this.version }
  }

  _isExpired(data) {
    return data.v != this.version || (data.expired != 0 && data.expired < Date.now())
  }

  async remember(name, valueFunc, timeout, tag) {
    return toUtil.doOrder(name, this.getLocks(tag), async () => {
      let data = await this.adapter.get(name, tag).catch(() => { })
      if (data !== undefined && !this._isExpired(data)) {
        return data.value
      }
      let value = await valueFunc()
      if (value !== undefined) {
        await this.adapter.set(name, this._data(value, timeout), tag).catch(e => {
          throw new Error(`Failed to set cache "${name}", msg:"${e.message}" , value: ${value.toString()}`)
        })
      }
      return value
    })
  }

  async set(name, value, timeout, tag) {
    return toUtil.doOrder(name, this.getLocks(tag), async () => {
      await this.adapter.set(name, this._data(value, timeout), tag).catch(e => {
        throw new Error(`Failed to set cache "${name}", msg:"${e.message}" , value: ${value.toString()}`)
      })
      return value
    })
  }

  static createWrap(cache, tag) {
    if (!(tag === undefined || typeof tag == 'string')) throw new Error('如果指定了 tag, 则必须为字符串')
    //value 为 undefined 等价与 cache.get()
    //value 为 null 等价于 cache.clear()
    //value 为 function 等价与 cache.remember()  只有当cache不存在的时候设置
    //value 为 其他值  等价与 cache.set()  总是设置
    let wrap = async function (name, value, timeout) {
      if (value === undefined) {
        return cache.get(name, tag)
      } else if (value === null) {
        return cache.clear(name, tag)
      } else if (typeof value == 'function') {
        return cache.remember(name, value, timeout, tag)
      } else {
        return cache.set(name, value, timeout, tag)
      }
    }

    wrap.get = async function (name) {
      return cache.get(name, tag)
    }

    wrap.clear = async function (name) {
      return cache.clear(name, tag)
    }

    wrap.remember = async function (name, value, timeout) {
      return cache.remember(name, value, timeout, tag)
    }

    wrap.set = async function (name, value, timeout) {
      return cache.set(name, value, timeout, tag)
    }

    wrap.clearTag = async function (tag2) {
      if (!tag) return cache.clearTag(tag2)
      if (tag2) throw new Error('tagCache.clearTag 无需指定参数')
      return cache.clearTag(tag)
    }

    wrap.close = function () {
      return cache.close()
    }

    if (!tag) {
      wrap.tag = function (tag2) {
        if (!(tag2 && typeof tag2 == 'string')) throw new Error('tag 必须为非空字符串')
        if (!cache._tags[tag2]) cache._tags[tag2] = Cache.createWrap(cache, tag2)
        return cache._tags[tag2]
      }
    }

    return wrap
  }
}

module.exports = Cache