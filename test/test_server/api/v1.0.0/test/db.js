'use strict'

module.exports = class {
  async succeed_Action(key, value) {
    await this.db.execute('INSERT INTO test_table VALUES(null,?,?)', [key, value])
    return 'succeed'
  }

  async failed_Action(key, value) {
    await this.db.execute('INSERT INTO test_table VALUES(null,?,?)', [key, value])
    return this.failed('failed')
  }

  async error_Action(key, value) {
    await this.db.execute('INSERT INTO test_table VALUES(null,?,?)', [key, value])
    return this.error('error')
  }

  async clearTable_Action() {
    await this.db.execute('DELETE FROM test_table WHERE 1')
    return true
  }

  async getRows_Action() {
    let rt = await this.db.executeOne('SELECT COUNT(*) n FROM test_table')
    return rt.n
  }

  async getModel_Action() {
    return this.model('test').name()
  }
}