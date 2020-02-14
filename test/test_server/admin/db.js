'use strict'

module.exports = class {
  async succeedAction(key, value) {
    await this.db.execute('INSERT INTO test_table VALUES(null,?,?)', [key, value])
    return 'succeed'
  }

  async failedAction(key, value) {
    await this.db.execute('INSERT INTO test_table VALUES(null,?,?)', [key, value])
    return this.failed('failed')
  }

  async errorAction(key, value) {
    await this.db.execute('INSERT INTO test_table VALUES(null,?,?)', [key, value])
    return this.error('error')
  }

  async clearTableAction() {
    await this.db.execute('DELETE FROM test_table WHERE 1')
    return true
  }

  async getRowsAction() {
    let rt = await this.db.executeOne('SELECT COUNT(*) n FROM test_table')
    return rt.n
  }

  async getModelAction() {
    return this.model('test').name()
  }
}