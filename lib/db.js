'use strict'

const mysql = require('mysql2/promise')
const theone = require('..')

const _options = Symbol('db options')
const _conn = Symbol('db conn')
const _begin = Symbol('db begin Transaction')
const _lazyInit = Symbol('db lazy init')
const _currentSql = Symbol('current query sql')

let dbPools = {}
/**
 * 惰性获取db资源及开启事务
 * (只有在第一次执行sql 时候才会获取 PromisePool 中的连接资源, 如何正式开启事务)
 */
module.exports = class Db {
  constructor(options) {
    this[_options] = options
    this[_conn] = undefined //惰性初始化
    this[_begin] = false //是否开启了事务
  }

  //设置惰性初始化时需要执行的函数, 必须在未使用前设置
  setLazyInit(cb) {
    if (this[_lazyInit] || this[_conn]) {
      throw new Error('Set too late, init has been completed')
    }
    this[_lazyInit] = cb
  }

  async _init() {
    if (this[_conn]) {
      return
    }
    if (!dbPools.hasOwnProperty(this.name)) {
      let opt = theone.util.deepCopy(this[_options])
      delete opt['name']
      delete opt['mustInTrans']
      dbPools[this.name] = await mysql.createPool(opt)
    }
    this[_conn] = await dbPools[this.name].getConnection()
    if (this[_begin]) {
      await this[_conn].beginTransaction()
    }
    if (this[_lazyInit]) {
      await this[_lazyInit](this)
    }
  }

  get name() {
    return this[_options]['name']
  }

  get database() {
    return this[_options]['database']
  }

  async query(sql, params, returnFields = false) {
    if (this[_currentSql]) {
      throw new Error('Sql is executing: ' + this[_currentSql])
    }
    if (!this[_begin] && this[_options]['mustInTrans']) {
      throw new Error('Not executed in a transaction: ' + sql)
    }
    try {
      if (!this[_conn]) {
        await this._init()
      }
      this[_currentSql] = sql
      if (params !== undefined && !Array.isArray(params)) {
        params = [params]
      }
      if (returnFields) {
        return await this[_conn].query(sql, params)
      } else {
        return (await this[_conn].query(sql, params))[0]
      }
    } catch (e) {
      throw new Error(e.message + `  sql:${sql}  params:${JSON.stringify(params)}`)
    } finally {
      this[_currentSql] = null
    }
  }

  //如果确定查询只会有1条记录,可以是用此接口快速返回第0行
  async queryOne(sql, params) {
    let rt = await this.query(sql, params)
    if (rt.length > 1) {
      throw new Error('More than one record')
    }
    return rt[0]
  }

  async queryM(batch, returnFields = false) {
    if (this[_currentSql]) {
      throw new Error('Sql is executing: ' + this[_currentSql])
    }
    let allSql = batch.map(v => v[0]).join('\n')
    if (!this[_begin] && this[_options]['mustInTrans']) {
      throw new Error('Not executed in a transaction: ' + allSql)
    }

    try {
      if (!this[_conn]) {
        await this._init()
      }
      this[_currentSql] = allSql

      let tasks = batch.map(async ([sql, params]) => {
        if (params !== undefined && !Array.isArray(params)) {
          params = [params]
        }
        if (returnFields) {
          return await this[_conn].execute(sql, params)
        } else {
          return (await this[_conn].execute(sql, params))[0]
        }
      })
      return await Promise.all(tasks)
    } catch (e) {
      let allParams = batch.map(v => v[1])
      throw new Error(e.message + `  allSql:${allSql}  allParams:${JSON.stringify(allParams)}`)
    } finally {
      this[_currentSql] = null
    }
  }

  //executeM 与 queryM 只是提高一个便捷接口, 并不能提高速度,因为是同一个连接,无法并发执行.
  //如果是insert, replace操作可 尝试使用batchInsert, batchReplace  它们可以有效提高速度
  async executeM(batch, returnFields = false) {
    if (this[_currentSql]) {
      throw new Error('Sql is executing: ' + this[_currentSql])
    }
    let allSql = batch.map(v => v[0]).join('\n')
    if (!this[_begin] && this[_options]['mustInTrans']) {
      throw new Error('Not executed in a transaction: ' + allSql)
    }

    try {
      if (!this[_conn]) {
        await this._init()
      }
      this[_currentSql] = allSql

      let tasks = batch.map(async ([sql, params]) => {
        if (params !== undefined && !Array.isArray(params)) {
          params = [params]
        }
        if (returnFields) {
          return await this[_conn].execute(sql, params)
        } else {
          return (await this[_conn].execute(sql, params))[0]
        }
      })
      return await Promise.all(tasks)
    } catch (e) {
      let allParams = batch.map(v => v[1])
      throw new Error(e.message + `  allSql:${allSql}  allParams:${JSON.stringify(allParams)}`)
    } finally {
      this[_currentSql] = null
    }
  }

  async execute(sql, params, returnFields = false) {
    if (this[_currentSql]) {
      throw new Error('Sql is executing: ' + this[_currentSql])
    }
    if (!this[_begin] && this[_options]['mustInTrans']) {
      throw new Error('Not executed in a transaction: ' + sql)
    }
    try {
      if (!this[_conn]) {
        await this._init()
      }
      this[_currentSql] = sql
      if (params !== undefined && !Array.isArray(params)) {
        params = [params]
      }
      if (returnFields) {
        return await this[_conn].execute(sql, params)
      } else {
        return (await this[_conn].execute(sql, params))[0]
      }
    } catch (e) {
      throw new Error(e.message + `  sql:${sql}  params:${JSON.stringify(params)}`)
    } finally {
      this[_currentSql] = null
    }
  }

  async executeOne(sql, params) {
    let rt = await this.execute(sql, params)
    if (rt.length > 1) {
      throw new Error('More than one record')
    }
    return rt[0]
  }

  async batchReplace(table, fields, data, maxRow = 1000, exeType = 'query') {
    await this._batchOperation('REPLACE', table, fields, data, '', maxRow, exeType)
  }

  async batchInsert(table, fields, data, onDuplicate = '', maxRow = 1000, exeType = 'query') {
    if (typeof onDuplicate == 'number') {
      maxRow = onDuplicate
      onDuplicate = ''
    }
    let dupStr = onDuplicate ? ' ON DUPLICATE KEY UPDATE ' + onDuplicate : ''
    await this._batchOperation('INSERT', table, fields, data, dupStr, maxRow, exeType)
  }

  async _batchOperation(op, table, fields, data, dupStr, maxRow, exeType) {
    let fieldsStr = ''
    let fieldsNum = fields
    if (Array.isArray(fields)) {
      fieldsNum = fields.length
      fieldsStr = '(`' + fields.join('`,`') + '`)'
    }
    let sql = op + ' INTO `' + table + '`' + fieldsStr + ' VALUES'
    let pattern = ',(?'
    for (let i = 1; i < fieldsNum; i++) {
      pattern += ',?'
    }
    pattern += ')'
    let values = ''
    let args = []
    for (let row of data) {
      values += pattern
      args.push(...row)
      if (maxRow != -1 && args.length >= maxRow * fieldsNum) {
        await this[exeType](sql + values.substr(1) + dupStr, args)
        values = ''
        args = []
      }
    }
    if (values != '') {
      await this[exeType](sql + values.substr(1) + dupStr, args)
    }
  }

  async beginTransaction() {
    if (!this[_begin] && this[_conn]) {
      await this[_conn].beginTransaction()
    }
    this[_begin] = true
  }

  async commit() {
    if (this[_begin] && this[_conn]) {
      await this[_conn].commit()
    }
    this[_begin] = false
  }

  async rollback() {
    if (this[_begin] && this[_conn]) {
      await this[_conn].rollback()
    }
    this[_begin] = false
  }

  async release() {
    if (this[_currentSql]) {
      throw new Error('Sql is executing: ' + this[_currentSql])
    }
    //回滚可能没提交的事务, 否则返回 DbPool 中会在这个连接下次分配时候生效
    await this.rollback()
    if (this[_conn]) {
      this[_conn].release()
      this[_conn] = undefined
    }
  }

  async transaction(cb) {
    try {
      await this.beginTransaction()
      let rt = await cb(this)
      await this.commit()
      return rt
    } catch (e) {
      await this.rollback()
      throw e
    } finally {
      await this.release()
    }
  }

  static async transaction(cb, options) {
    let db = new this(options)
    return await db.transaction(async () => {
      return await cb(db)
    })
  }

  static async close() {
    for (let name in dbPools) {
      await dbPools[name].end()
    }
    dbPools = {}
  }
}
