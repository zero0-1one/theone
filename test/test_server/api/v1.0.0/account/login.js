'use strict'

module.exports = class {
  static middleware() {
    return ['midA', 'midC']
  }

  loginByEmail_Action(email, password) {
    if (password.length < 5) {
      throw new Error('password is too short :' + password)
    }
    return [email, password]
  }

  loginByPhone_Action(phone, password) {
    return [phone, password]
  }

  setSession_Action(data) {
    this.ctx.session.data = data
    return data
  }


  getSession_Action() {
    return this.ctx.session.data
  }

  createToken_Action(data) {
    return this.sign({ data })
  }


  getToken_Action() {
    return this.ctx.state.user
  }

  getCallMid_Action() {
    return this.callMid
  }
}