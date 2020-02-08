'use strict'

const mysql = require('mysql2/promise')
const toUtil = require('./util')

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
    if (typeof options[name] != 'string') throw new Error('必须在 options 中指定 name 属性, 且相同 name 的连接都使用第一个该 name 的 options')
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
      let opt = toUtil.deepCopy(this[_options])
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
   *    maxRow: sql中含 pattern 时最多拼接多少组参数 默认 0 (不限制一次执行完)
   */
  async _exec(type, sql, params, options = {}) {
    if (this[_currentSql]) throw new Error('Sql is executing: ' + this[_currentSql])
    if (!this[_begin] && this[_options]['mustInTrans']) throw new Error('Not executed in a transaction: ' + sql)

    if (typeof options == 'boolean') options = { fields: options }  //历史版本兼容

    try {
      if (!this[_conn]) await this._init()

      this[_currentSql] = sql
      if (params !== undefined && !Array.isArray(params)) params = [params]


      let patternIndex = !params ? -1 : params.findIndex(p => Array.isArray(p))
      if (patternIndex == -1) {  //没有pattern
        if (options.fields) {
          return await this[_conn][type](sql, params)
        } else {
          return (await this[_conn][type](sql, params))[0]
        }
      } else { //有 pattern 的sql
        options = Object.assign({ regexp: /\{(.*)\}(.*)\.\.\./, maxRow: 0 }, options)
        let pattern = sql.match(options.regexp)
        if (!pattern || pattern.length != 3) throw new Error('未找到正确的 pattern 字符串或连接符')

        let data = params[patternIndex]
        let placeNum = pattern[0].replace(/[^?]/g, "").length // 计算 ? 的个数
        let is2d = Array.isArray(data[0])
        let patternNum = is2d ? data.length : data.length / placeNum
        if (!(patternNum > 0 && Number.isInteger(patternNum))) throw new Error('pattern 参数个数不匹配')


        let leftParams = params.slice(0, patternIndex)
        let rightParams = params.slice(patternIndex + 1)
        let allParams = null
        let realSql = ''
        let maxRow = options.maxRow
        if (maxRow > 0) {//指定了 最大执行数
          let results = []
          let n = Math.floor(patternNum / maxRow)
          let dataNum = is2d ? maxRow : maxRow * placeNum
          realSql = sql.replace(pattern[0], pattern[1] + toUtil.repeatStr(pattern[2] + pattern[1], maxRow - 1))
          for (let i = 0; i < n; i++) {
            allParams = leftParams.concat(...data.slice(i * dataNum, (i + 1) * dataNum), rightParams)
            results.concat((await this[_conn][type](realSql, allParams))[0])
          }
          let rest = patternNum - maxRow * n
          if (rest > 0) {
            realSql = sql.replace(pattern[0], pattern[1] + toUtil.repeatStr(pattern[2] + pattern[1], rest - 1)) //数量变化 重新计算
            allParams = leftParams.concat(...data.slice(is2d ? n * maxRow : n * maxRow * placeNum), rightParams)
            results.concat((await this[_conn][maxRow > 10 ? 'query' : type](realSql, allParams))[0]) // maxRow 比较大的时候 固定使用 query 方法, 比保证不会有太多的 Prepared Statements
          }
          return results
        } else {
          realSql = sql.replace(pattern[0], pattern[1] + toUtil.repeatStr(pattern[2] + pattern[1], patternNum - 1))
          allParams = leftParams.concat(...data, rightParams)
          return (await this[_conn][type](realSql, allParams))[0]
        }
      }
    } catch (e) {
      throw new Error(e.message + `  sql:${sql}  params:${JSON.stringify(params)}`)
    } finally {
      this[_currentSql] = null
    }
  }


  async query(sql, params, options) {
    return this._exec('query', sql, params, options)
  }

  async execute(sql, params, options) {
    return this._exec('execute', sql, params, options)
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
    let pattern = ',(?' + toUtil.repeatStr(',?', fieldsNum - 1) + ')'
    let values = ''
    let args = []
    for (let row of data) {
      values += pattern
      args.push(...row)
      if (maxRow != -1 && args.length >= maxRow * fieldsNum) {
        let a = await this._exec(exeType, sql + values.substr(1) + dupStr, args)
        values = ''
        args = []
      }
    }
    if (values != '') {
      let b = await this._exec(exeType, sql + values.substr(1) + dupStr, args)
    }
  }

  async beginTransaction() {
    if (!this[_begin] && this[_conn]) {
      await this[_conn].beginTransaction()
    }
    this[_begin] = true
  }

  async commit(keepTrans = false) {
    if (this[_currentSql]) throw new Error('Sql is executing: ' + this[_currentSql])
    if (this[_begin] && this[_conn]) {
      await this[_conn].commit()
    }
    if (keepTrans) {
      await this[_conn].beginTransaction()
    } else {
      this[_begin] = false
    }
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
    let db = new Db(options)
    return await db.transaction(async () => {
      return await cb(db)
    })
  }

  //不会主动开启 transaction,  如果传 mustInTrans 则会覆盖 options 中的 mustInTrans 属性
  static async safeCall(cb, options, mustInTrans) {
    options = toUtil.deepCopy(options)
    if (mustInTrans !== undefined) options['mustInTrans'] = !!mustInTrans
    let db = new Db(options)
    try {
      await cb(db)
    } finally {
      db.release()
    }
  }

  static async close() {
    for (let name in dbPools) {
      await dbPools[name].end()
    }
    dbPools = {}
  }
}
