'use strict'

module.exports = class {
  loginByEmailAction(email, password) {
    if (password.length < 5) {
      throw new Error(' password is too short :' + password)
    }
    return [email, password]
  }

  loginByPhoneAction(phone, password) {
    return [phone, password]
  }
}