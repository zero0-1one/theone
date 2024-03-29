const mysql = require('mysql2/promise')
const toUtil = require('./util')

const _options = Symbol('db options')
const _conn = Symbol('db conn')
const _begin = Symbol('db begin Transaction')
const _currentSql = Symbol('current query sql')
const _bind = Symbol('bind other db')


const MAX_ROWS_DEFAULT = 1000

let dbPools = {}
/**
 * 惰性获取db资源及开启事务
 * (只有在第一次执行sql 时候才会获取 PromisePool 中的连接资源, 如何正式开启事务)
 */
module.exports = class Db {
  constructor(options) {
    if (typeof options.name != 'string')
      throw new Error('必须在 options 中指定 name 属性, 且相同 name 的连接都使用第一个该 name 的 options')
    this[_options] = options
    this[_conn] = undefined //惰性初始化
    this[_begin] = false //是否开启了事务
  }

  async _delayBegin() {
    if (this[_begin] && !this[_conn]) {
      this[_conn] = await this._getPool().getConnection()
      await this[_conn].beginTransaction()
    }
  }



  get name() {
    return this[_options]['name']
  }

  get database() {
    return this[_options]['database']
  }


  parsePatternQuery(sql, params, options = {}) {
    const patternIndex = params.findIndex(p => Array.isArray(p))
    if (patternIndex == -1) {
      throw new Error('Pattern values not found')
    }
    const pattern = sql.match(options.regexp || /\{(.*)\}(.*)\.\.\./)
    if (!pattern || pattern.length != 3) {
      throw new Error('Could not match pattern or connector')
    }
    const data = params[patternIndex]
    if (!Array.isArray(data)) {
      throw new Error('Pattern values must be an Array')
    }
    const placeNum = pattern[0].replace(/[^?]/g, '').length
    const is2d = Array.isArray(data[0])
    const patternNum = is2d ? data.length : data.length / placeNum
    if (!(patternNum > 0 && Number.isInteger(patternNum))) {
      throw new Error('The number of pattern values does not match')
    }

    const leftParams = params.slice(0, patternIndex)
    const rightParams = params.slice(patternIndex + 1)

    let allParams = null
    let realSql = ''
    const results = []
    //这个地方是分页
    //patternNum其实就是数据总条数
    let maxRow = options.maxRow == undefined ? MAX_ROWS_DEFAULT : options.maxRow == 0 ? patternNum : options.maxRow
    maxRow = Math.min(patternNum, maxRow)
    const n = Math.floor(patternNum / maxRow)
    if (n > 0) {
      const dataNum = is2d ? maxRow : maxRow * placeNum
      realSql = sql.replace(pattern[0], pattern[1] + (pattern[2] + pattern[1]).repeat(maxRow - 1))
      for (let i = 0; i < n; i++) {
        allParams = leftParams.concat(...data.slice(i * dataNum, (i + 1) * dataNum), rightParams)
        results.push([realSql, allParams])
      }
    }
    const rest = patternNum - maxRow * n
    if (rest > 0) {
      realSql = sql.replace(pattern[0], pattern[1] + (pattern[2] + pattern[1]).repeat(rest - 1))
      allParams = leftParams.concat(...data.slice(is2d ? n * maxRow : n * maxRow * placeNum), rightParams)
      results.push([realSql, allParams])
    }
    return results
  }

  /**
   * 带 pattern 的参数示例:
   *  _exec('execute', 'SELECT * FROM t WHERE  id = ? or  {(id > ? and a < ?)} or ...  ', [0, [1, 2, 3, 4]] )
   *  _exec('execute', 'SELECT * FROM t WHERE  id = ? or  {(id > ? and a < ?)} or ...  ', [0, [[1, 2], [3, 4]]] )     //pattern 参数为2维数组
   *  上面两种写法都相当于
   *  _exec('execute', 'SELECT * FROM t WHERE  id = ? or (id > ? and a < ?) or  (id > ? and a < ?) ', [0, 1,2,3,4] )
   */
  /**
   *
   * @param {*} type
   * @param {*} sql
   * @param {*} params
   * @param {*} options
   *    fields: 是否返回 fields 属性
   *    regexp: pattern 正则表达式, sql中含 pattern 时候指定, 必须捕获2个值, 第一个为 需要重复的字符串, 第二个为连接符,
   *    maxRow: sql中含 pattern 时最多拼接多少组, INSERT, REPLACE  默认 1000； SELECT, UPDATE  默认 0 一次执行完
   */
  async _exec(sql, params = [], call) {
    if (this[_currentSql]) throw new Error('Sql is executing: ' + this[_currentSql])
    if (!this[_begin] && this[_options]['mustInTrans']) throw new Error('Not executed in a transaction: ' + sql)
    try {
      if (this[_begin]) await this._delayBegin()
      this[_currentSql] = sql
      return await call()
    } catch (e) {
      let summary = params.slice(0, 50)
      if (summary.length < params.length) summary.push(`... ${params.length - summary.length} items ...`)
      for (let d of summary) {
        if (Array.isArray(d) && d.length > 5) d.splice(5, d.length - 5, `... ${d.length - 5} items ...`)
      }
      e.message += `  sql:${sql}  params:${JSON.stringify(summary)}`
      throw e
    } finally {
      this[_currentSql] = null
    }
  }

  _getPool() {
    if (!toUtil.hasOwnPropertySafe(dbPools, this.name)) {
      let opt = Object.assign({}, this[_options])
      delete opt['name']
      delete opt['mustInTrans']
      dbPools[this.name] = mysql.createPool(opt)
    }
    return dbPools[this.name]
  }

  async _call(type, sql, params) {
    if (this[_conn]) {
      return this[_conn][type](sql, params)
    } else {
      return this._getPool()[type](sql, params)
    }
  }

  async query(sql, params, options = {}) {
    if (params !== undefined && !Array.isArray(params)) params = [params]
    return this._exec(sql, params, async () => {
      let rt = await this._call('query', sql, params)
      return options.fields ? rt : rt[0]
    })
  }

  async execute(sql, params, options = {}) {
    if (params !== undefined && !Array.isArray(params)) params = [params]
    return this._exec(sql, params, async () => {
      let rt = await this._call('execute', sql, params)
      return options.fields ? rt : rt[0]
    })
  }

  async patternQuery(sql, params, options = {}) {
    const results = []
    await this._exec(sql, params, async () => {
      const paramsArray = this.parsePatternQuery(sql, params, options)
      for (const params of paramsArray) {
        const rt = await this._call('query', params[0], params[1])
        results.push(options.fields ? rt : rt[0])
      }
    })
    return results
  }

  //如果确定查询只会有1条记录,可以是用此接口快速返回第0行
  async queryOne(sql, params) {
    let rt = await this.query(sql, params)
    if (rt.length > 1) {
      throw new Error('More than one record')
    }
    return rt[0]
  }

  async executeOne(sql, params) {
    let rt = await this.execute(sql, params)
    if (rt.length > 1) {
      throw new Error('More than one record')
    }
    return rt[0]
  }

  isBegin() {
    return this[_begin]
  }

  //将其他 db 使用绑定到当前 db 上，使其他 db 同时开启,提交或回滚事务，
  //!注意这只是简单实现，并不保证事务一致性， 对重要数据请使用分布式事务解决方案
  async bind(db) {
    if (!this[_bind]) this[_bind] = []
    if (this[_bind].includes(db)) return false //已经存在
    this[_bind].push(db)
    if (this[_begin] && !db[_begin]) await db.beginTransaction()
    return true
  }

  unbind(db) {
    if (!this[_bind]) return false
    let index = this[_bind].indexOf(db)
    if (index == -1) return false
    this[_bind].splice(index, 1)
    return true
  }

  async beginTransaction() {
    if (this[_begin]) {
      throw new Error('Transaction has begun')
    }
    this[_begin] = true
    if (this[_bind]) {
      for (const db of this[_bind]) {
        if (!db[_begin]) await db.beginTransaction()
      }
    }
  }

  async commit(keepTrans = false) {
    if (this[_currentSql]) throw new Error('Sql is executing: ' + this[_currentSql])
    if (this[_bind]) {
      for (const db of this[_bind]) {
        await db.commit(keepTrans)
      }
    }
    if (this[_begin] && this[_conn]) {
      await this[_conn].commit()
      if (keepTrans) await this[_conn].beginTransaction()
    }
    if (!keepTrans) {
      this[_begin] = false
      if (this[_conn]) {
        await this[_conn].release()
        this[_conn] = undefined
      }
    }
  }

  async rollback() {
    if (this[_bind]) {
      for (const db of this[_bind]) {
        await db.rollback()
      }
    }
    if (this[_begin] && this[_conn]) {
      await this[_conn].rollback()
    }
    this[_begin] = false
    if (this[_conn]) {
      await this[_conn].release()
      this[_conn] = undefined
    }
  }

  async release() {
    //回滚可能没提交的事务, 否则返回 DbPool 中会在这个连接下次分配时候生效
    await this.rollback()
    if (this[_conn]) {
      await this[_conn].release()
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
    let db = new Db(options)
    return await db.transaction(cb)
  }

  //不会主动开启 transaction,  如果传 mustInTrans 则会覆盖 options 中的 mustInTrans 属性
  static async call(cb, options, mustInTrans) {
    options = toUtil.deepCopy(options)
    if (mustInTrans !== undefined) options['mustInTrans'] = !!mustInTrans
    let db = new Db(options)
    try {
      return await cb(db)
    } finally {
      await db.release()
    }
  }

  static async close() {
    const task = Object.keys(dbPools).map(name => dbPools[name].end())
    dbPools = {}
    await Promise.all(task)
  }
}
