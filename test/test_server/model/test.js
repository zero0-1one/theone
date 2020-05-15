'use strict'

module.exports = class {
  name() {
    return 'global'
  }

  add() {
    this._testAdd = this._testAdd ? this._testAdd + 1 : 1
    return this._testAdd
  }
}
