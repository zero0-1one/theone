'use strict'

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
    let value = await theone.cache(name)
    return { value }
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
