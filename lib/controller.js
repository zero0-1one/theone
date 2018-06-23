'use strict'

const theone = require('..')
const fs = require('fs')
const path = require('path')
const compareVersions = require('compare-versions')
const getParamNames = require('@captemulation/get-parameter-names')
const modle = require('./modle')

const _ctrls = Symbol('controllers')
const _modles = Symbol('modles')
const _init = Symbol('controller init')
const _mainDb = Symbol('main db')
const _parent = Symbol('controller parent')

let allModules = undefined
let controller = {
  extends(parent) {
    return class extends parent {
      constructor(ctx, moduleName, name, common) {
        super()
        this.ctx = ctx
        this.module = moduleName
        this.name = name
        this.common = common
      }

      [_init](parent) {
        if (parent) {
          for (let options of theone.config['database']) {
            this[options.name] = parent[options.name]
          }
          this[_parent] = parent
          this[_ctrls] = parent[_ctrls]
          this[_modles] = parent[_modles]
          this[_mainDb] = parent[_mainDb]
        } else {
          for (let options of theone.config['database']) {
            this[options.name] = new theone.env.DB_CLASS(options)
          }
          this[_mainDb] = this[theone.config['database'][0].name]
          this[_ctrls] = {}
          this[_modles] = {}
        }
      }

      modle(name) {
        if (!this[_modles].hasOwnProperty(name)) {
          this[_modles][name] = modle.creatModle(this, name)
        }
        return this[_modles][name]
      }

      ctrl(name) {
        if (!this[_ctrls].hasOwnProperty(name)) {
          let ctrl = controller.getCtrl(this.module, name, this.common)
          this[_ctrls][name] = new ctrl.class(this.ctx, this.module, name, this.common)
          this[_ctrls][name][_init](this)
        }
        return this[_ctrls][name]
      }

      async destroy() {
        if (this[_parent]) {
          throw new Error('Child controller cannot be destroyed')
        }
        for (let options of theone.config['database']) {
          await this[options.name].release()
        }
      }
    }
  },

  inheritLastVersion(owner, suffix, lastVersion) {
    let ownerPro = owner.prototype
    let lastPro = lastVersion.prototype
    for (let name in lastPro) {
      if (name.endsWith(suffix) && (name.startsWith('_') || ownerPro.hasOwnProperty('_' + name))) {
        continue
      }
      if (!ownerPro.hasOwnProperty(name)) {
        ownerPro[name] = lastPro[name]
      }
    }
    return owner
  },

  loadController(controllerFile, suffix, ctrlName, data = {}, lastVersion) {
    let owner = require(controllerFile)
    if (lastVersion) {
      owner = this.inheritLastVersion(owner, suffix, lastVersion)
    }
    let names = Object.getOwnPropertyNames(owner.prototype)
    ctrlName = ctrlName.substr(0, ctrlName.length - 1)
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

  loadModule(moduleDir, suffix, ctrlName = '', data = {}, lastVersion) {
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
        this.loadModule(filePath, suffix, ctrlName + file + '/', data, lastVersion)
      }
    })
    return data
  },

  loadVersions(dir, suffix, autoExtends) {
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
        data[version] = this.loadModule(versionDir, suffix, '', {}, lastVersion)
        lastVersion = data[version]
      } else {
        data[version] = this.loadModule(versionDir, suffix)
      }
    })
    return data
  },

  load() {
    allModules = {}
    for (let options of theone.config['modules']) {
      let dir = theone.path(options['parentDir'], options['name'])
      if (options['multiVersion']) {
        allModules[options.name] = this.loadVersions(dir, options['actionSuffix'], options['autoExtends'])
        allModules[options.name]._multiVersion = true
      } else {
        allModules[options.name] = this.loadModule(dir, options['actionSuffix'])
        allModules[options.name]._multiVersion = false
      }
      allModules[options.name]._actionSuffix = options['actionSuffix']
    }
    return allModules
  },

  getCtrl(moduleName, ctrlName, common) {
    let version = common['version']
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

  async callAction(ctx, actionMiddlewares, moduleName, ctrl, action, args, common = {}) {
    try {
      let ctrlInst = new ctrl.class(ctx, moduleName, ctrl.name, common)
      ctrlInst[_init]()
      let rt = await ctrlInst[_mainDb].transaction(async () => {
        let sortArgs = []
        for (let name of action.params) {
          sortArgs.push(args[name])
        }
        if (actionMiddlewares) {
          return await actionMiddlewares((ctx, ctrlInst, async () => {
            return await action.func.apply(ctrlInst, sortArgs)
          }))
        } else {
          return await action.func.apply(ctrlInst, sortArgs)
        }
      })
      await ctrlInst.destroy()
      return rt
    } catch (e) {
      let actionPath = `${moduleName}/${ctrl.name}/${action.name}`
      if (e instanceof Error) {
        theone.log.error('Call action exception,  actionPath:"%s", msg:"%s"\nstack:"%s"', actionPath, e.message, e.stack)
      } else {
        theone.log.error('Call action exception,  actionPath:"%s", msg:"%s"', actionPath, e.toString())
      }
      throw new Error(`Call action exception,  actionPath:"${actionPath}"`) //不对外暴露异常细节,记录日志
    }
  },

  async batchCall(ctx, actionMiddlewares, actions, common = {}) {
    let results = []
    for (let [moduleName, actionPath, args] of actions) {
      try {
        let index = actionPath.lastIndexOf('/')
        if (index <= 0) {
          throw new TypeError(`Invalid actionPath: "${actionPath}"`)
        }
        let ctrlName = actionPath.substr(0, index)
        let actionName = actionPath.substr(index + 1)
        let ctrl = this.getCtrl(moduleName, ctrlName, common)
        if (!ctrl.actions.hasOwnProperty(actionName)) {
          throw new TypeError(`"${moduleName}/${ctrlName}" controller  does not have function: "${actionName}"`)
        }
        let action = ctrl.actions[actionName]
        let data = await this.callAction(ctx, actionMiddlewares, moduleName, ctrl, action, args, common)
        results.push({ succeed: 1, data })
      } catch (e) {
        results.push({ succeed: 0, msg: e.toString() })
      }
    }
    return results
  },

  parsePath(path) {
    let index = path.indexOf('/', 1)
    if (index < 0) {
      return new TypeError(`Path does not specify module name, path:"${path}"`)
    }
    let moduleName = path[0] == '/' ? path.substr(1, index - 1) : path.substr(0, index)
    let module = allModules[moduleName]
    if (!module) {
      throw new TypeError(`"${moduleName}" module does not exist`)
    }
    let names = path.substr(index + 1).split('/')
    if (module._multiVersion) {
      let version = names.shift()
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
    return [moduleName, ctrl, ctrl.actions[actionName], args]
  },

  //返回 koa Middlewares
  callActions(actionMiddlewares) {
    if (!allModules) {
      this.load()
    }
    return async function callActions(ctx, next) {
      let { actions, common } = ctx.request.body || {}
      if (Array.isArray(actions) && actions.length > 0) {
        ctx.body = await controller.batchCall(ctx, actionMiddlewares, actions, common)
      } else {
        try {
          let [moduleName, ctrl, action, args] = controller.parsePath(ctx.path)
          ctx.body = await controller.callAction(ctx, actionMiddlewares, moduleName, ctrl, action, Object.assign(ctx.query, args), common)
        } catch (e) {
          ctx.body = { succeed: 0, msg: e.toString() }
        }
      }
      await next()
    }
  }
}

module.exports = controller