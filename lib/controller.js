'use strict'

const theone = require('..')
const fs = require('fs')
const path = require('path')
const compareVersions = require('compare-versions')
const compose = require('koa-compose')
const getParamNames = require('@captemulation/get-parameter-names')
const model = require('./model')
const Response = require('./response')


const _ctrls = Symbol('controllers')
const _models = Symbol('models')
const _init = Symbol('controller init')
const _mainDb = Symbol('main db')
const _parent = Symbol('controller parent')

let allModules = undefined
let controller = {
  extends(parent) {
    return class extends parent {
      constructor(ctx, moduleName, name, args) {
        super(ctx, args)
        this.ctx = ctx
        this.module = moduleName
        this.name = name
        this.args = args
      }

      [_init](parent) {
        let module = allModules[this.module]
        if (parent) {
          for (let options of module._database) {
            this[options.name] = parent[options.name]
          }
          this[_parent] = parent
          this[_ctrls] = parent[_ctrls]
          this[_models] = parent[_models]
          this[_mainDb] = parent[_mainDb]
        } else {
          for (let options of module._database) {
            this[options.name] = new theone.env.DB_CLASS(options)
          }
          this[_mainDb] = this[module._mainDbName]
          this[_ctrls] = {}
          this[_models] = {}
        }
      }

      model(name) {
        if (!this[_models].hasOwnProperty(name)) {
          this[_models][name] = new allModules[this.module][_models][name](this)
        }
        return this[_models][name]
      }

      //只允许同模块引用, 保证封装性, 便于同模块轻松分离
      ctrl(name) {
        if (!this[_ctrls].hasOwnProperty(name)) {
          let ctrl = controller.getCtrl(this.module, name, this.args)
          this[_ctrls][name] = new ctrl.class(this.ctx, this.module, name, this.args)
          this[_ctrls][name][_init](this)
        }
        return this[_ctrls][name]
      }

      //不会回滚数据库
      failed(data) {
        return new Response(data, 'failed')
      }

      succeed(data) {
        return new Response(data, 'succeed')
      }

      //回滚数据库
      error(data) {
        return new Response(data, 'error')
      }

      async destroy() {
        if (this[_parent]) {
          throw new Error('Child controller cannot be destroyed')
        }
        let module = allModules[this.module]
        for (let options of module._database) {
          await this[options.name].release()
        }
      }
    }
  },

  inheritLastVersion(owner, suffix, lastVersion) {
    let ownerPro = owner.prototype
    let lastPro = lastVersion.class.prototype.__proto__
    let proNames = Object.getOwnPropertyNames(lastPro)
    for (let name of proNames) {
      if (name.endsWith(suffix) && (name.startsWith('_') || ownerPro.hasOwnProperty('_' + name))) {
        continue
      }
      if (!ownerPro.hasOwnProperty(name)) {
        ownerPro[name] = lastPro[name]
      }
    }
    return owner
  },

  loadMiddlewares(dir, ctrlClass) {
    let middlewares = []
    if (dir && typeof ctrlClass.middleware == 'function') { //静态方法定义 middleware
      let defs = ctrlClass.middleware()
      for (const def of defs) {
        let name = typeof def == 'string' ? def : def.name
        let args = typeof def == 'string' ? {} : def.args
        let mid = require(path.join(dir, name + '.js'))
        middlewares.push(mid(args))
      }
    }
    if (middlewares.length > 0) {
      return compose(middlewares)
    }
  },

  loadController(controllerFile, suffix, ctrlName, data = {}, lastVersion) {
    let owner = require(controllerFile)
    ctrlName = ctrlName.substr(0, ctrlName.length - 1)
    if (lastVersion && lastVersion[ctrlName]) {
      owner = this.inheritLastVersion(owner, suffix, lastVersion[ctrlName])
    }
    let names = Object.getOwnPropertyNames(owner.prototype)
    let ctrl = data[ctrlName] = {}
    ctrl.name = ctrlName
    ctrl.class = this.extends(owner)
    ctrl.actions = {}
    for (let action of names) {
      if (!action.startsWith('_') && action.endsWith(suffix)) { //找出action
        let actionName = action.substr(0, action.length - suffix.length)
        ctrl.actions[actionName] = {
          name: actionName,
          func: owner.prototype[action],
          params: getParamNames(owner.prototype[action])
        }
      }
    }
    return data
  },

  _loadModule(moduleDir, suffix, ctrlName, data, lastVersion) {
    fs.readdirSync(moduleDir).forEach(file => {
      if (file.startsWith('_')) { //所有以 '_' 开头的文件夹和文件都被过滤
        return
      }
      let filePath = path.join(moduleDir, file)
      let stat = fs.statSync(filePath)
      if (file.endsWith('.js') && stat.isFile()) {
        let c = path.basename(filePath, '.js')
        this.loadController(filePath, suffix, ctrlName + c + '/', data, lastVersion)
      } else if (stat.isDirectory()) {
        this._loadModule(filePath, suffix, ctrlName + file + '/', data, lastVersion)
      }
    })

    if (lastVersion) {
      //新版本没有的模块默认继承上一个版本
      for (const m in lastVersion) {
        if (!data[m]) data[m] = lastVersion[m]
      }
    }
    return data
  },

  loadModule(moduleDir, middlewareDir, suffix, lastVersion) {
    let data = this._loadModule(moduleDir, suffix, '', {}, lastVersion)
    for (const name in data) {
      let ctrl = data[name]
      ctrl.class._middleware = this.loadMiddlewares(middlewareDir, ctrl.class)
    }
    return data
  },

  loadVersions(dir, middlewareDir, suffix, autoExtends) {
    let data = {}
    let versions = fs.readdirSync(dir).filter(version => {
      if (version.startsWith('_')) { //所有以 '_' 开头的文件夹和文件都被过滤
        return false
      }
      let versionDir = path.join(dir, version)
      return fs.statSync(versionDir).isDirectory() //version 是文件夹
    })
    versions.sort(compareVersions) //排序 先加载小版本
    let lastVersion = undefined
    versions.forEach(version => {
      let versionDir = path.join(dir, version)
      if (autoExtends) {
        data[version] = this.loadModule(versionDir, middlewareDir, suffix, lastVersion)
        lastVersion = data[version]
      } else {
        data[version] = this.loadModule(versionDir, middlewareDir, suffix)
      }
    })
    return data
  },

  load() {
    allModules = {}
    let middlewareDir = theone.path(theone.config['middlewareDir'])
    let globalModels = model.loadModel(theone.path(theone.config['modelDir']))
    for (let options of theone.config['modules']) {
      let dir = theone.path(options['parentDir'], options['name'])
      if (options['multiVersion']) {
        allModules[options.name] = this.loadVersions(dir, middlewareDir, options['actionSuffix'], options['autoExtends'])
        allModules[options.name]._multiVersion = true
      } else {
        allModules[options.name] = this.loadModule(dir, middlewareDir, options['actionSuffix'])
        allModules[options.name]._multiVersion = false
      }
      allModules[options.name]._mainDbName = options['mainDb']
      allModules[options.name]._database = options['database']
      allModules[options.name]._autoTransaction = options['autoTransaction']

      if (options['internalModel']) {
        allModules[options.name][_models] = model.loadModel(path.join(dir, theone.config['modelDir']))
      } else {
        allModules[options.name][_models] = globalModels
      }
    }
    return allModules
  },

  getCtrl(moduleName, ctrlName, args) {
    let version = args['version']
    let module = allModules[moduleName]
    if (!module) {
      throw new TypeError(`"${moduleName}" module does not exist`)
    }
    if (module._multiVersion) {
      if (!module.hasOwnProperty(version)) {
        throw new TypeError(`"${moduleName}" module does not have version: "${version}"`)
      }
      module = module[version]
    }
    if (!module.hasOwnProperty(ctrlName)) {
      throw new TypeError(`"${moduleName}" module does not have controller: "${ctrlName}"`)
    }
    return module[ctrlName]
  },

  async _callAction(ctx, middlewares, moduleName, ctrl, action, args) {
    let ctrlInst
    try {
      ctrlInst = new ctrl.class(ctx, moduleName, ctrl.name, args)
      ctrlInst[_init]()
      let call = async () => {
        let sortArgs = []
        for (let name of action.params) {
          sortArgs.push(args[name])
        }
        let rt = null
        if (middlewares) {
          rt = await middlewares({ ctrl: ctrlInst, action: action.name }, async () => {
            return await action.func.apply(ctrlInst, sortArgs)
          })
        } else {
          rt = await action.func.apply(ctrlInst, sortArgs)
        }
        if (!(rt instanceof Response)) {
          rt = ctrlInst.succeed(rt)
        }
        if (rt.isError() && allModules[moduleName]._autoTransaction) {
          ctrlInst[_mainDb].rollback()
        }
        return rt
      }
      if (allModules[moduleName]._autoTransaction) {
        return await ctrlInst[_mainDb].transaction(call)
      } else {
        return await call()
      }
    } catch (e) {
      let actionPath = `${moduleName}/${ctrl.name}/${action.name}`
      if (e instanceof Error) {
        theone.log.error('Call action exception,  actionPath:"%s", args:%s, msg:"%s"\nstack:"%s"', actionPath, JSON.stringify(args), e.message, e.stack)
      } else {
        theone.log.error('Call action exception,  actionPath:"%s", args:%s, msg:"%s"', actionPath, JSON.stringify(args), e.toString())
      }
      throw new Error(`Call action exception,  actionPath:"${actionPath}"`) //不对外暴露异常细节,记录日志
    } finally {
      if (ctrlInst) ctrlInst.destroy()
    }
  },


  parsePath(path) {
    let index = path.indexOf('/', 1)
    if (index < 0) {
      throw new TypeError(`Path does not specify module name, path:"${path}"`)
    }
    let moduleName = path[0] == '/' ? path.substr(1, index - 1) : path.substr(0, index)
    let module = allModules[moduleName]
    if (!module) {
      throw new TypeError(`"${moduleName}" module does not exist`)
    }
    let names = path.substr(index + 1).split('/')
    let version = ''
    if (module._multiVersion) {
      version = names.shift()
      if (!module.hasOwnProperty(version)) {
        throw new TypeError(`"${moduleName}" module  does not have version: "${version}"`)
      }
      module = module[version]
    }

    let argsArray = []
    let actionName = ''
    let ctrl = undefined
    while (names.length >= 2) {
      actionName = names.pop()
      let ctrlName = names.join('/')
      if (module.hasOwnProperty(ctrlName) && module[ctrlName].actions.hasOwnProperty(actionName)) {
        ctrl = module[ctrlName]
        break
      }
      argsArray.push(actionName)
    }
    if (!ctrl) {
      throw new TypeError(`Invalid actionPath: "${path}"`)
    }
    let args = {}
    for (let i = argsArray.length - 1; i > 0; i -= 2) {
      args[argsArray[i]] = decodeURIComponent(argsArray[i - 1])
    }
    args.version = version
    return [moduleName, ctrl, ctrl.actions[actionName], args]
  },

  //返回 koa Middlewares
  callAction(middlewares) {
    if (!allModules) {
      this.load()
    }
    return async function callAction(ctx, next) {
      try {
        let [moduleName, ctrl, action, args] = controller.parsePath(ctx.path)
        args = Object.assign({}, ctx.query, ctx.request.body || {}, args)
        let rt = await controller._callAction(ctx, middlewares, moduleName, ctrl, action, args)
        // ctx.actionResponse = rt
        rt.send(ctx)
        await next()
      } catch (e) {
        if (theone.env.DEBUG) theone.log.error(e.message)
        ctx.response.status = 404
      }
    }
  }
}

module.exports = controller