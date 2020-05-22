const { isMainThread, workerData } = require('worker_threads')

const toUtil = require('./util')
const model = require('./model')
const fs = require('fs')
const path = require('path')

const _models = Symbol('models')
const _mainDb = Symbol('main db')
const _newInModel = Symbol.for('new in model()')
const _caches = Symbol('action caches')

let allWokers = {}
let allModels = null
/**
 * 仅在 worker 线程使用，为了使 worker 线程有类似主线程的编程体验
 */
module.exports = {
  init(worker) {
    let config = theone.config
    let options = config['workers'].find(v => v.name == worker)
    if (isMainThread && !options.debug) {
      throw new Error(`不能在 主线程中加载  ${worker} Worker`)
    } else if (!isMainThread && workerData.options.name != worker) {
      throw new Error(`不能在 ${workerData.options.name} Worker 线程中加载  ${worker} Worker`)
    }

    if (!allModels) allModels = model.loadModel(theone.path(config['modelDir'])) //必须在入口文件前加载全局model
    if (!allWokers[worker]) {
      let data = this.loadDir(theone.path(options['dir']), options['actionSuffix'])
      allWokers[worker] = { data, options }
    }
  },

  loadDir(moduleDir, suffix, name = '', data = {}) {
    fs.readdirSync(moduleDir).forEach(file => {
      if (file.startsWith('_')) return //所有以 '_' 开头的文件夹和文件都被过滤
      let filePath = path.join(moduleDir, file)
      let stat = fs.statSync(filePath)
      if (file.endsWith('.js') && stat.isFile()) {
        let w = path.basename(filePath, '.js')
        this.loadWorker(filePath, suffix, name + w, data)
      } else if (stat.isDirectory()) {
        this.loadDir(filePath, suffix, name + file + '/', data)
      }
    })
    return data
  },

  loadWorker(workerFile, suffix, name, data = {}) {
    let owner = require(workerFile)
    if (typeof owner != 'function') return data // 不是 class

    let names = Object.getOwnPropertyNames(owner.prototype)
    let worker = (data[name] = {})
    worker.class = this.extends(owner)
    worker.actions = {}
    for (let action of names) {
      if (typeof owner.prototype[action] != 'function') continue
      if (!action.startsWith('_') && action.endsWith(suffix)) {
        let actionName = action.slice(0, action.length - suffix.length)
        worker.actions[actionName] = {
          name: actionName,
          func: owner.prototype[action],
          params: toUtil.getMemberFunctionParams(owner.prototype[action]),
        }
      }
    }
    return data
  },

  extends(parent) {
    return class extends parent {
      constructor(ctx, options = {}) {
        super()
        this.ctx = ctx
        if (!ctx.rootCtrl) ctx.rootCtrl = this //入口 ctrl
        this.options = {}
        this.options['database'] = options['database'] || theone.config['database']
        this.options['mainDb'] = options['mainDb'] || this.options['database'][0]['name']
        this.options['autoTransaction'] = options['autoTransaction'] == undefined ? true : options['autoTransaction']

        for (let options of this.options['database']) {
          this[options['name']] = new theone.env.DB_CLASS(options)
        }
        this[_mainDb] = this[this.options['mainDb']]
        this[_models] = {}
      }

      model(name) {
        if (!toUtil.hasOwnPropertySafe(this[_models], name)) {
          if (!toUtil.hasOwnPropertySafe(allModels, name)) throw new Error(`不存在 '${name}' model`)
          let model = new allModels[name](this, _newInModel)
          for (let options of this.options['database']) {
            model[options['name']] = this[options['name']]
          }
          this[_models][name] = model
        }
        return this[_models][name]
      }

      //只支持默认缓存
      async cache(name, value, timeout) {
        let rootCtrl = this.ctx.rootCtrl
        let caches = (rootCtrl[_caches] = rootCtrl[_caches] || {})
        if (value === undefined) {
          if (toUtil.hasOwnPropertySafe(caches, name)) return caches[name]
        } else if (typeof value == 'function') {
          if (toUtil.hasOwnPropertySafe(caches, name) && caches[name] !== undefined) return caches[name]
        } else if (value === null) {
          caches[name] = undefined
          return theone.cache.clear(name)
        }
        caches[name] = await theone.cache(name, value, timeout) //不存在也记录
        return caches[name]
      }

      //清空当前 action 访问的所有缓存（包括get，set）， 通常用于 action 有异常需要回滚的时候
      async cacheRollback() {
        let rootCtrl = this.ctx.rootCtrl
        let caches = rootCtrl[_caches]
        if (!caches) return
        for (const name in caches) {
          if (caches[name] !== undefined) await theone.cache.clear(name)
        }
        delete rootCtrl[_caches]
      }

      async destroy() {
        if (this !== this.ctx.rootCtrl) {
          throw new Error('Only the root controller needs to be destroyed')
        }
        for (let options of this.options['database']) {
          await this[options['name']].release()
        }
      }
    }
  },

  async callAction(path, args) {
    let workerInst
    try {
      let splits = path.split('/')
      let worker = splits.shift()
      let actionName = splits.pop()
      let name = splits.join('/')
      if (!allWokers[worker]) this.init(worker)
      let { data, options } = allWokers[worker]
      let action = data[name].actions[actionName]
      let ctrlInst = new data[name].class({}, options)
      let sortArgs = toUtil.getFunctionArgs(args, action.params, ({ msg }) => {
        throw new TypeError(msg)
      })
      if (ctrlInst.options['autoTransaction']) {
        let db = ctrlInst[_mainDb]
        await db.beginTransaction()
        let rt = await action.func.apply(ctrlInst, sortArgs).catch(e => {
          db.rollback()
          ctrlInst.cacheRollback()
          throw e
        })
        db.commit()
        return rt
      } else {
        return await action.func.apply(ctrlInst, sortArgs)
      }
    } finally {
      if (workerInst) workerInst.destroy()
    }
  },
}
