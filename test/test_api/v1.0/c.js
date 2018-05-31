'use strict'

module.exports = class {
  c_1() {
    return 1
  }
  c_2Action(a, b) {
    return a + b
  }

  _c_3Action() {
    return 3
  }

  async c_4Action(x, y = 10) {
    return x * y
  }
}