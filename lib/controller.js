'use strict'

const theone = require('..')
const fs = require('fs')
const path = require('path')
const getParamNames = require('@captemulation/get-parameter-names')
const modle = require('./modle')

const _ctrls = Symbol('controllers')
const _modles = Symbol('modles')
const _init = Symbol('controller init')
const _mainDb = Symbol('main db')

let allModules = undefined
let controller = {
  extends(parent) {
    return class extends parent {
      constructor(moduleName, name, common) {
        super()
        this.module = moduleName
        this.name = name
        this.common = common
      }

      [_init](parent) {
        if (parent) {
          for (let options of theone.config['database']) {
            this[options.name] = parent[options.name]
          }
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

      module(name) {
        if (!(name in this[_modles])) {
          this[_modles][name] = modle.creatModle(this, name)
        }
        return this[_modles][name]
      }

      ctrl(name) {
        if (!(name in this[_ctrls])) {
          let ctrl = controller.getCtrl(this.module, name, this.common)
          this[_ctrls][name] = new ctrl.class(this.module, name, this.common)
          this[_ctrls][name][_init](this)
        }
        return this[_ctrls][name]
      }
    }
  },

  loadController(controllerFile, suffix, ctrlName, data = {}) {
    let owner = require(controllerFile)
    let names = Object.getOwnPropertyNames(owner.prototype)
    let ctrl = data[ctrlName.substr(0, ctrlName.length - 1)] = {}
    ctrl.class = this.extends(owner)
    ctrl.actions = {}
    for (let action of names) {
      if (!action.startsWith('_') && action.endsWith(suffix)) { //找出action
        let actionName = action.substr(0, action.length - suffix.length)
        ctrl.actions[actionName] = {
          func: owner.prototype[action],
          params: getParamNames(owner.prototype[action])
        }
      }
    }
    return data
  },

  loadModule(moduleDir, suffix, ctrlName = '', data = {}) {
    let files = fs.readdirSync(moduleDir)
    for (let file of files) {
      if (file.startsWith('_')) { //所有以 '_' 开头的文件夹和文件都被过滤
        continue
      }
      let filePath = path.join(moduleDir, file)
      let stat = fs.statSync(filePath)
      if (file.endsWith('.js') && stat.isFile()) {
        let c = path.basename(filePath, '.js')
        this.loadController(filePath, suffix, ctrlName + c + '/', data)
      } else if (stat.isDirectory()) {
        this.loadModule(filePath, suffix, ctrlName + file + '/', data)
      }
    }
    return data
  },

  loadVersions(dir, suffix) {
    let data = {}
    let versions = fs.readdirSync(dir)
    for (let version of versions) {
      if (version.startsWith('_')) { //所有以 '_' 开头的文件夹和文件都被过滤
        continue
      }
      let versionDir = path.join(dir, version)
      if (fs.statSync(versionDir).isDirectory()) { //version 是文件夹
        data[version] = this.loadModule(versionDir, suffix)
      }
    }
    return data
  },

  load() {
    allModules = {}
    for (let options of theone.config['modules']) {
      let dir = theone.path(options['parentDir'], options['name'])
      if (options['multiVersion']) {
        allModules[options.name] = this.loadVersions(dir, options['actionSuffix'])
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
    let ctrl
    if (module._multiVersion) {
      if (!module[version]) {
        throw new TypeError(`"${moduleName}" module  does not have version: "${version}"`)
      }
      ctrl = module[version][ctrlName]
    } else {
      ctrl = module[ctrlName]
    }
    if (!ctrl) {
      throw new TypeError(`"${moduleName}" module  does not have controller: "${ctrlName}"`)
    }
    return ctrl
  },

  async callAction(actionMiddlewares, moduleName, actionPath, args, common) {
    let index = actionPath.lastIndexOf('/')
    if (index <= 0) {
      throw new TypeError(`Invalid actionPath: "${actionPath}"`)
    }
    let ctrlName = actionPath.substr(0, index)
    let actionName = actionPath.substr(index + 1)
    let ctrl = this.getCtrl(moduleName, ctrlName, common)
    let action = ctrl.actions[actionName]
    if (!action) {
      throw new TypeError(`"${moduleName}/${ctrlName}" controller  does not have function: "${actionName}"`)
    }
    let ctrlInst = new ctrl.class(moduleName, ctrlName, common)
    ctrlInst[_init]()
    return await ctrlInst[_mainDb].transaction(async () => {
      let sortArgs = []
      for (let name of action.params) {
        sortArgs.push(args[name])
      }
      if (actionMiddlewares) {
        return await actionMiddlewares((ctrlInst, async () => {
          return await action.func.apply(ctrlInst, sortArgs)
        }))
      } else {
        return await action.func.apply(ctrlInst, sortArgs)
      }

    })
  },

  //返回 koa Middlewares
  batchCall(actionMiddlewares) {
    if (!allModules) {
      this.load()
    }
    return async function batchCall(ctx, next) {
      let { common, actions } = ctx.request.body
      let results = []
      for (let [moduleName, actionPath, args] of actions) {
        try {
          let data = await controller.callAction(actionMiddlewares, moduleName, actionPath, args, common)
          results.push({ succeed: 1, data })
        } catch (e) {
          results.push({ succeed: 0, msg: `Call action exception,  actionPath:"${moduleName}/${actionPath}"` })
          theone.log.error(`Call action exception,  actionPath:"${moduleName}/${actionPath}", msg:"${e.message}"`)
        }
      }
      ctx.body = results
      await next()
    }
  }
}

module.exports = controller