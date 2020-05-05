const assert = require('assert')
module.exports = class {
  succeed_Action() {
    return 'succeed'
  }

  failed_Action() {
    return this.failed('failed')
  }

  error_Action() {
    return this.error('error')
  }

  throw_Action() {
    throw new Error('error')
  }

  paramInt_Action(arg = Int) {
    return arg
  }

  paramString_Action(arg = String) {
    return arg
  }

  paramBoolean_Action(arg = Boolean) {
    return arg
  }

  paramDate_Action(arg = Date) {
    return arg
  }

  async setCache_Action(name, value, isThrow = false) {
    await this.cache(name, value)
    if (isThrow) throw new Error()
    return { value }
  }

  async getCache_Action(name) {
    let value = await this.cache(name)
    return { value }
  }

  async cacheRepeatedly_Action() {
    let rt1 = await this.cache('aaaa', 123)
    let rt2 = await this.cache('aaaa', async () => 456)
    let rt3 = await this.cache('aaaa', 456)
    let rt4 = await this.cache('aaaa')
    await this.cache('aaaa', null)
    let rt5 = await this.cache('aaaa', async () => 789)
    assert(rt1 == 123)
    assert(rt2 == 123)
    assert(rt3 == 456)
    assert(rt4 == 456)
    assert(rt5 == 789)
    return true
  }

  injectAfter_Action(arg) {
    let dbCtrl = this.ctrl('test/db')
    let data = {}
    for (const key in arg) {
      this.inject(key, arg[key])
      data[key] = dbCtrl[key]
    }
    return data
  }

  injectBefore_Action(arg) {
    for (const key in arg) {
      this.inject(key, arg[key])
    }
    let dbCtrl = this.ctrl('test/db')
    let data = {}
    for (const key in arg) {
      data[key] = dbCtrl[key]
    }
    return data
  }

  injectMixed_Action(after, before) {
    for (const key in before) {
      this.inject(key, before[key])
    }
    let dbCtrl = this.ctrl('test/db')
    for (const key in after) {
      dbCtrl.inject(key, after[key])
    }

    let data = { after: {}, before: {} }
    for (const key in after) {
      data.after[key] = this[key]
    }
    for (const key in before) {
      data.before[key] = dbCtrl[key]
    }
    return data
  }
}
