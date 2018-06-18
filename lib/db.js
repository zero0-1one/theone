'use strict'

const mysql = require('mysql2/promise')
const theone = require('..')

const _options = Symbol('db options')
const _conn = Symbol('db conn')
const _begin = Symbol('db begin Transaction')

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

  async _init() {
    if (this[_conn]) {
      return
    }
    if (!dbPools.hasOwnProperty(this.name)) {
      dbPools[this.name] = await mysql.createPool(this[_options])
    }
    this[_conn] = await dbPools[this.name].getConnection()
    if (this[_begin]) {
      await this[_conn].beginTransaction()
    }
  }

  get name() {
    return this[_options]['name']
  }

  get database() {
    return this[_options]['database']
  }

  async query(sql, params, returnFields = false) {
    if (params !== undefined && !Array.isArray(params)) {
      params = [params]
    }
    if (!this[_conn]) {
      await this._init()
    }
    if (returnFields) {
      return await this[_conn].query(sql, params)
    } else {
      return (await this[_conn].query(sql, params))[0]
    }
  }

  //如果确定查询只会有1条记录,可以是用此接口快速返回第0行
  async queryOne(sql, params) {
    let rt = (await this.query(sql, params))
    if (rt.length > 1) {
      throw new Error('More than one record')
    }
    return rt[0]
  }


  async execute(sql, params, returnFields = false) {
    if (params !== undefined && !Array.isArray(params)) {
      params = [params]
    }
    if (!this[_conn]) {
      await this._init()
    }
    if (returnFields) {
      return await this[_conn].execute(sql, params)
    } else {
      return (await this[_conn].execute(sql, params))[0]
    }
  }

  async executeOne(sql, params) {
    let rt = (await this.execute(sql, params))
    if (rt.length > 1) {
      throw new Error('More than one record')
    }
    return rt[0]
  }

  async batchInsert(table, fields, data, onDuplicate = '', maxRow = 1000) {
    if (typeof onDuplicate == 'number') {
      maxRow = onDuplicate
      onDuplicate = ''
    }
    let fieldsStr = ''
    let fieldsNum = fields
    if (Array.isArray(fields)) {
      fieldsNum = fields.length
      fieldsStr = '(`' + fields.join('`,`') + '`)'
    }
    let dupStr = onDuplicate ? ' ON DUPLICATE KEY UPDATE ' + onDuplicate : ''
    let sql = 'INSERT INTO `' + table + '`' + fieldsStr + ' VALUES'
    let pattern = ',(?'
    for (let i = 1; i < fieldsNum; i++) {
      pattern += ',?'
    }
    pattern += ')'
    let values = ''
    let args = []
    maxRow *= fieldsNum
    for (let row of data) {
      values += pattern
      args.push(...row)
      if (args.length >= maxRow) {
        await this.query(sql + values.substr(1) + dupStr, args)
        values = ''
        args = []
      }
    }
    if (values != '') {
      await this.query(sql + values.substr(1) + dupStr, args)
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

  static createByName(name) {
    return new Db(theone.config['databaseMap'][name])
  }
}