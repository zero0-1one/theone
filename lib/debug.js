'use strict'
/**
 * 当 theone.env.DEBUG 为true时 加载此模块, 否则加载 release 模块
 */

const { Db, config, log } = require('..')
const tail = require('zo-tail-f')


let dbLogWatcher = []

module.exports = {
  start() {
    return this.startSqlLog()
  },

  async stop() {
    for (let watcher of dbLogWatcher) {
      watcher.close()
    }
  },

  async startSqlLog() {
    if (!config['log']['sqlLog']) {
      return
    }
    let databaseCfg = config['database']

    let logFiles = new Set()
    for (let options of databaseCfg) {
      if (options['host'] != 'localhost') {
        log.sql('Database[%s] host is not "localhost", sql log can not be show. ', options['name'])
        continue
      }
      await Db.transaction(async db => {
        let rt = await db.queryOne('show variables like "general_log"')
        if (rt.Value.toUpperCase() == 'OFF') {
          log.sql('Database[%s] general_log is OFF, sql log can not be show', options['name'])
          return
        }
        rt = await db.queryOne('show variables like "general_log_file"')
        logFiles.add(rt.Value)
      }, options)
    }
    for (let file of logFiles) {
      let watcher = tail.watch(file, { encoding: 'utf8', mode: 'line' })
      watcher.on('line', line => {
        log.sql(line)
      })
      dbLogWatcher.push(watcher)
    }
  }
}