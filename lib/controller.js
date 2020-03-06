'use strict'

const theone = require('..')
const fs = require('fs')
const path = require('path')
const { Parser } = require("acorn")
const compareVersions = require('compare-versions')
const compose = require('koa-compose')
const model = require('./model')
const Response = require('./response')


const _ctrls = Symbol('controllers')
const _models = Symbol('models')
const _init = Symbol('controller init')
const _mainDb = Symbol('main db')
const _parent = Symbol('controller parent')


//有外部请求错误引起的异常，只记录info 日志， （其他异常会记录 error 日志）
class RequestError extends Error {

}


//转换失败 返回 undefined,  类型标识写法支持的都是 js 内置的全局变量
const typeConversion = {
  parseInt(val) {
    let num = parseInt(val)
    if (!isNaN(num)) return num
  },

  parseFloat() {
    let num = parseFloat(val)
    if (!isNaN(num)) return num
  },

  Number(val) {
    let num = Number(val)
    if (!isNaN(num)) return num
  },

  //通过 evn.USE_INT 指定是否启用 Int 类型，
  Int(val) {
    let num = parseInt(val)
    if (!isNaN(num)) return num
  },

  //BigInt 目前都 通过 parseInt 转换
  BigInt(val) {
    let num = parseInt(val)
    if (!isNaN(num)) return num
  },

  String(val) {
    if (val === undefined) return
    return val.toString()
  },

  Boolean(val) {
    if (typeof val == 'string') {
      if (val.trim().toLowerCase() === 'false') return false
    }
    return !!val
  },

  Date(val) {
    if (typeof val == 'number' || (typeof val == 'string' && val.length > 0)) {
      let time = new Date(val)
      if (!isNaN(time.valueOf())) return time
    }
  },

  Object(val) {
    let type = typeof val
    if (type == 'object' && !Array.isArray(val)) return val
    if (type == 'string') {
      try {
        let data = JSON.parse(val)
        if (typeof data == 'object' && !Array.isArray(data)) return data
      } catch (e) { }
    }
  },

  Array(val) {
    if (Array.isArray(val)) return val
    if (typeof val == 'string') {
      try {
        let data = JSON.parse(val)
        if (Array.isArray(data)) return data
      } catch (e) { }
    }
  }
}


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

  loadMiddlewares(dir, ctrlClass, moduleDefs = []) {
    let middlewares = []
    let defs = [...moduleDefs]
    if (dir && typeof ctrlClass.middleware == 'function') { //静态方法定义 middleware
      defs.push(...ctrlClass.middleware())
    }
    for (const def of defs) {
      let name = typeof def == 'string' ? def : def.name
      let args = typeof def == 'string' ? {} : def.args
      let mid = require(path.join(dir, name + '.js'))
      middlewares.push(mid(args))
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
      if (typeof owner.prototype[action] != 'function') continue
      if (!action.startsWith('_') && action.endsWith(suffix)) { //找出action
        let actionName = action.substr(0, action.length - suffix.length)
        ctrl.actions[actionName] = {
          name: actionName,
          func: owner.prototype[action],
          params: this.getParams(owner.prototype[action])
        }
      }
    }
    return data
  },

  getParamsDefaultType(right) {
    switch (right.type) {
      case 'Identifier':
        return right.name
      case 'Literal':
        return (typeof right.value).replace(/^\S/, s => s.toUpperCase())
      case 'ArrayExpression':
        return 'Array'
      case 'ObjectExpression':
        return 'Object'
      case 'NewExpression':
        return right.callee.type == 'Identifier' ? right.callee.name : undefined
      default:
        return
    }
  },

  getActionArgs(args, params) {
    let sortArgs = []
    for (let param of params) {
      let arg = args[param.name]
      if (arg === undefined) {
        if (param.conversion && !param.hasDefault) throw new RequestError(`参数 ${param.name} 必须是 ${param.type} 类型`)
      } else {
        if (param.conversion) {
          arg = param.conversion(arg)
          if (arg === undefined) throw new RequestError(`参数 ${param.name} 必须是 ${param.type} 类型`)
        }
      }
      sortArgs.push(arg)
    }
    return sortArgs
  },

  getParams(memberFunction) {
    let code = 'class A{\n' + memberFunction.toString() + '\n}'
    let ast = Parser.parse(code)
    let paramsAst = ast.body[0].body.body[0].value.params
    let params = []
    for (const paramAst of paramsAst) {
      let param = {}
      switch (paramAst.type) {
        case 'Identifier':
          param.name = paramAst.name
          break
        case 'AssignmentPattern':
          if (paramAst.left.type == 'Identifier') {
            param.name = paramAst.left.name
            param.code = code.slice(paramAst.start, paramAst.end)
            param.type = this.getParamsDefaultType(paramAst.right)
            //通过 Identifier 指定的类型不会当成默认值 如: a = Number   则当 a 为 undefined 时候不会赋值为 Number (函数) 而是报异常
            param.hasDefault = !(paramAst.right.type == 'Identifier' && typeConversion.hasOwnProperty(param.type))
            if (typeConversion.hasOwnProperty(param.type)) {
              param.conversion = typeConversion[param.type]
            }
          } else {
            throw new Error('不支持参数解析写法，因为无法确定原参数名。 code:' + code.slice(paramAst.start, paramAst.end))
          }
          break
        default:
          throw new Error('暂不支持的参数写法，code:' + code.slice(paramAst.start, paramAst.end))
      }
      params.push(param)
    }
    return params
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

  loadModule(moduleDir, middlewareDir, options, lastVersion) {
    let suffix = options['actionSuffix']
    let data = this._loadModule(moduleDir, suffix, '', {}, lastVersion)
    for (const name in data) {
      let ctrl = data[name]
      ctrl.class._middleware = this.loadMiddlewares(middlewareDir, ctrl.class, options['middleware'])
    }
    return data
  },

  loadVersions(dir, middlewareDir, options) {
    let suffix = options['actionSuffix']
    let autoExtends = options['autoExtends']
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
        data[version] = this.loadModule(versionDir, middlewareDir, options, lastVersion)
        lastVersion = data[version]
      } else {
        data[version] = this.loadModule(versionDir, middlewareDir, options)
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
        allModules[options.name] = this.loadVersions(dir, middlewareDir, options)
        allModules[options.name]._multiVersion = true
      } else {
        allModules[options.name] = this.loadModule(dir, middlewareDir, options)
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
      throw new RequestError(`"${moduleName}" module does not exist`)
    }
    if (module._multiVersion) {
      if (!module.hasOwnProperty(version)) {
        throw new RequestError(`"${moduleName}" module does not have version: "${version}"`)
      }
      module = module[version]
    }
    if (!module.hasOwnProperty(ctrlName)) {
      throw new RequestError(`"${moduleName}" module does not have controller: "${ctrlName}"`)
    }
    return module[ctrlName]
  },

  async _callAction(ctx, middlewares, moduleName, ctrl, action, args) {
    let ctrlInst
    try {
      ctrlInst = new ctrl.class(ctx, moduleName, ctrl.name, args)
      ctrlInst[_init]()
      let call = async () => {
        let sortArgs = this.getActionArgs(args, action.params)
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
    } finally {
      if (ctrlInst) ctrlInst.destroy()
    }
  },


  parsePath(path) {
    let index = path.indexOf('/', 1)
    if (index < 0) {
      throw new RequestError(`Path does not specify module name, path:"${path}"`)
    }
    let moduleName = path[0] == '/' ? path.substr(1, index - 1) : path.substr(0, index)
    let module = allModules[moduleName]
    if (!module) {
      throw new RequestError(`"${moduleName}" module does not exist`)
    }
    let names = path.substr(index + 1).split('/')
    let version = ''
    if (module._multiVersion) {
      version = names.shift()
      if (!module.hasOwnProperty(version)) {
        throw new RequestError(`"${moduleName}" module  does not have version: "${version}"`)
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
      throw new RequestError(`Invalid actionPath: "${path}"`)
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
        if (e instanceof RequestError) { //RequestError 属于外部调用错误，只记录 info 日志
          theone.log.info('Call action exception,  path:"%s", body:%s, msg:"%s"\nstack:"%s"', ctx.path, ctx.request.body, e.message, e.stack)
        } else if (e instanceof Error) {
          theone.log.error('Call action exception,  path:"%s", body:%s, msg:"%s"\nstack:"%s"', ctx.path, ctx.request.body, e.message, e.stack)
        } else {
          theone.log.error('Call action exception,  path:"%s", body:%s, msg:"%s"', ctx.path, ctx.request.body, e.toString())
        }
        ctx.response.status = 404
      }
    }
  }
}

module.exports = controller