
const theone = require('..')
const fs = require('fs')
const path = require('path')
const { Parser } = require('acorn')
const compareVersions = require('compare-versions')
const compose = require('koa-compose')
const { sign } = require('jsonwebtoken')
const model = require('./model')
const { Response, RequestError } = require('./response')


const _ctrls = Symbol('controllers')
const _inject = Symbol('controller inject map')
const _injectData = Symbol('inject function')
const _models = Symbol('models')
const _init = Symbol('controller init')
const _mainDb = Symbol('main db')
const _newInModel = Symbol.for('new in model()')




//转换失败 返回 undefined,  类型标识写法支持的都是 js 内置的全局变量
const typeConversion = {
  parseInt(val) {
    let num = parseInt(val)
    if (!isNaN(num)) return num
  },

  parseFloat(val) {
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
      constructor(ctx, args) {
        super(ctx, args)
        this.ctx = ctx
        if (!ctx.rootCtrl) ctx.rootCtrl = this  //入口 ctrl
        this.args = args
      }

      [_init]() {
        let rootCtrl = this.ctx.rootCtrl
        if (this === rootCtrl) {
          let injectMap = new Map()
          let module = allModules[this.module]
          for (let options of module._database) {
            injectMap.set(options['name'], new theone.env.DB_CLASS(options))
          }
          injectMap.set(_mainDb, injectMap.get(module._mainDbName))
          injectMap.set(_ctrls, { [this.name]: this })
          injectMap.set(_models, {})
          this[_injectData](injectMap)
        } else {
          this[_injectData](rootCtrl[_inject])
        }
      }

      model(name) {
        if (!this[_models].hasOwnProperty(name)) {
          let models = allModules[this.module][_models]
          if (!models.hasOwnProperty(name)) throw new Error(`当前模块不存在 '${name}' model`)
          let model = new models[name](this, _newInModel)
          for (let options of allModules[this.module]._database) {
            model[options['name']] = this[options['name']]
          }
          this[_models][name] = model
        }
        return this[_models][name]
      }

      //只允许同模块引用, 保证封装性, 便于同模块轻松分离
      ctrl(name) {
        if (!this[_ctrls].hasOwnProperty(name)) {
          let ctrl = controller.getCtrl(this.module, name, this.version)
          this[_ctrls][name] = new ctrl.class(this.ctx, this.args)
          this[_ctrls][name][_init]()
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

      sign(data, expiresIn) {
        let cfg = theone.config['jwt']
        let options = Object.assign({}, cfg['options'])
        if (expiresIn) options.expiresIn = expiresIn
        let token = sign(data, cfg['secret'], options)
        if (token.length > 512) theone.log.warn('JWT 数据太大, 不要把它当成数据缓存. data:' + JSON.stringify(data).slice(0, 200) + '...')
        return token
      }

      //为当前请求创建的所有 ctrl 注入 属性，（包括：rootCtrl 以及 通过 rootCtrl.ctrl() 创建的ctrl）
      inject(key, value) {
        this[_inject].set(key, value)
        for (const ctrlName in this[_ctrls]) {
          this[_ctrls][ctrlName][key] = value
        }
      }

      [_injectData](injectMap) {
        this[_inject] = injectMap
        for (const [key, value] of injectMap) {
          this[key] = value
        }
      }

      async destroy() {
        if (this !== this.ctx.rootCtrl) {
          throw new Error('Only the root controller needs to be destroyed')
        }
        let module = allModules[this.module]
        for (let options of module._database) {
          await this[options['name']].release()
        }
      }
    }
  },

  inheritLastVersion(owner, suffix, lastVersion) {
    let ownerPro = owner.prototype
    let lastPro = Object.getPrototypeOf(lastVersion.class.prototype)
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

  //
  loadMiddlewares(dir, ctrl, middlewaresCfg = []) {
    let middlewares = []
    let defs = middlewaresCfg.filter(mid => {
      if (typeof mid == 'string') return true
      if (typeof mid.unless == 'function') return !mid.unless({ ctrlName: ctrl.name })
      return true
    })
    let ctrlClass = ctrl.class
    if (dir && typeof ctrlClass.middleware == 'function') { //静态方法定义 middleware
      defs.push(...ctrlClass.middleware())
    }
    let set = new Set()
    for (const def of defs) {
      let name = typeof def == 'string' ? def : def.name
      let args = typeof def == 'string' ? {} : def.args
      let mid = require(path.join(dir, name + '.js'))
      if (set.has(name)) throw new Error(`${ctrl.name} 包含重复的中间件:${name}`)
      set.add(name)
      middlewares.push(mid(args))
    }
    if (middlewares.length > 0) {
      return compose(middlewares)
    }
  },

  injectPrototype(ctrlClass, inject) {
    let prototype = ctrlClass.prototype
    for (const name in inject) {
      prototype[name] = inject[name]
    }
  },

  loadController(controllerFile, suffix, ctrlName, data = {}, lastVersion, inject = {}) {
    let owner = require(controllerFile)
    ctrlName = ctrlName.slice(0, ctrlName.length - 1)
    if (lastVersion && lastVersion[ctrlName]) {
      owner = this.inheritLastVersion(owner, suffix, lastVersion[ctrlName])
    }
    let names = Object.getOwnPropertyNames(owner.prototype)
    let ctrl = data[ctrlName] = {}
    inject.name = ctrl.name = ctrlName
    ctrl.class = this.extends(owner)
    this.injectPrototype(ctrl.class, inject)
    ctrl.actions = {}
    for (let action of names) {
      if (typeof owner.prototype[action] != 'function') continue
      if (!action.startsWith('_') && action.endsWith(suffix)) { //找出action
        let actionName = action.slice(0, action.length - suffix.length)
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

  _loadModule(moduleDir, options, ctrlName, data, lastVersion, inject) {
    let suffix = options['actionSuffix']
    let modelPath = options['internalModel'] ? theone.pathNormalize(options['parentDir'], options['name'], theone.config['modelDir']) : ''
    fs.readdirSync(moduleDir).forEach(file => {
      if (file.startsWith('_')) return  //所有以 '_' 开头的文件夹和文件都被过滤
      let filePath = path.join(moduleDir, file)
      if (filePath == modelPath) return //internalModel 文件夹
      let stat = fs.statSync(filePath)
      if (file.endsWith('.js') && stat.isFile()) {
        let c = path.basename(filePath, '.js')
        this.loadController(filePath, suffix, ctrlName + c + '/', data, lastVersion, inject)
      } else if (stat.isDirectory()) {
        this._loadModule(filePath, options, ctrlName + file + '/', data, lastVersion, inject)
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

  loadModule(moduleDir, middlewareDir, options, lastVersion, inject = {}) {

    let data = this._loadModule(moduleDir, options, '', {}, lastVersion, inject)
    for (const name in data) {
      let ctrl = data[name]
      ctrl.class._middleware = this.loadMiddlewares(middlewareDir, ctrl, options['middleware'])
    }
    return data
  },

  loadVersions(dir, middlewareDir, options, inject = {}) {
    let autoExtends = options['autoExtends']
    let [min, max] = Array.isArray(options['multiVersion']) ? options['multiVersion'] : [null, null]
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
    for (const version of versions) {
      let isBelow = (min && compareVersions(version, min) < 0)
      if (!autoExtends && isBelow) continue // 如果指定 autoExtends 则不能跳过, 因为高版本需要继承低版本的方法
      if (max && compareVersions(version, max) > 0) break //高则可直接结束

      let versionDir = path.join(dir, version)
      inject.version = version
      lastVersion = this.loadModule(versionDir, middlewareDir, options, autoExtends ? lastVersion : undefined, inject)
      if (!isBelow) data[version] = lastVersion
    }
    return data
  },

  load() {
    allModules = {}
    let middlewareDir = theone.path(theone.config['middlewareDir'])
    //必须按如下顺序加载:  globalModels => internalModels  => 
    let globalModels = model.loadModel(theone.path(theone.config['modelDir']))
    let internalModels = {}
    for (let options of theone.config['modules']) {
      if (options['internalModel']) {
        let dir = theone.path(options['parentDir'], options['name'])
        internalModels[options['name']] = model.loadModel(path.join(dir, theone.config['modelDir']))
      }
    }

    for (let options of theone.config['modules']) {
      let dir = theone.path(options['parentDir'], options['name'])
      let inject = { module: options['name'] }
      if (options['multiVersion']) {
        allModules[options['name']] = this.loadVersions(dir, middlewareDir, options, inject)
        allModules[options['name']]._multiVersion = true
      } else {
        allModules[options['name']] = this.loadModule(dir, middlewareDir, options, undefined, inject)
        allModules[options['name']]._multiVersion = false
      }
      allModules[options['name']]._mainDbName = options['mainDb']
      allModules[options['name']]._database = options['database']
      allModules[options['name']]._autoTransaction = options['autoTransaction']
      if (options['internalModel']) {
        allModules[options['name']][_models] = internalModels[options['name']]
      } else {
        allModules[options['name']][_models] = globalModels
      }
    }
    return allModules
  },

  getCtrl(moduleName, ctrlName, version) {
    let module = allModules[moduleName]
    if (!module) {
      throw new Error(`"${moduleName}" module does not exist`)
    }
    if (module._multiVersion) {
      if (!module.hasOwnProperty(version)) {
        throw new Error(`"${moduleName}" module does not have version: "${version}"`)
      }
      module = module[version]
    }
    if (!module.hasOwnProperty(ctrlName)) {
      throw new Error(`"${moduleName}" module does not have controller: "${ctrlName}"`)
    }
    return module[ctrlName]
  },

  async _callAction(ctx, middlewares, moduleName, ctrl, action, args) {
    let ctrlInst
    try {
      ctrlInst = new ctrl.class(ctx, args)
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

  //返回koa Middleware
  parsePath() {
    if (!allModules) {
      this.load()
    }

    return async function parsePath(ctx, next) {
      try {
        let path = ctx.path
        let index = path.indexOf('/', 1)
        if (index < 0) {
          throw new RequestError(`Path does not specify module name, path:"${path}"`)
        }
        let moduleName = path[0] == '/' ? path.slice(1, index) : path.slice(0, index)
        let module = allModules[moduleName]
        if (!module) {
          throw new RequestError(`"${moduleName}" module does not exist`)
        }
        let names = path.slice(index + 1).split('/')
        let version = null
        if (module._multiVersion) {
          if (module.hasOwnProperty(names[0])) {
            version = names.shift()
          } else if (ctx.query.hasOwnProperty('version') && module.hasOwnProperty(ctx.query.version)) {
            version = ctx.query.version
          } else {
            throw new RequestError(`"${moduleName}" is multi-version module, but cannot find a valid version in the path`)
          }
          module = module[version]
        }

        let argsArray = []
        let actionName = ''
        let ctrlName = ''
        let ctrl = undefined
        let action = undefined
        while (names.length >= 2) {
          actionName = names.pop()
          ctrlName = names.join('/')
          if (module.hasOwnProperty(ctrlName) && module[ctrlName].actions.hasOwnProperty(actionName)) {
            ctrl = module[ctrlName]
            action = ctrl.actions[actionName]
            break
          }
          argsArray.push(actionName)
        }
        if (!ctrl) {
          throw new RequestError(`Invalid actionPath: "${path}"`)
        }
        let _args = {}
        for (let i = argsArray.length - 1; i > 0; i -= 2) {
          _args[argsArray[i]] = decodeURIComponent(argsArray[i - 1])
        }
        ctx.pathInfo = { moduleName, ctrlName, ctrl, actionName, action, _args, version }
      } catch (e) {
        if (e instanceof RequestError) { //RequestError 属于外部调用错误，只记录 debug 日志
          theone.log.debug('Call action exception,  href:"%s", body:%s\n%s', ctx.href, ctx.request.rawBody, e.stack)
          ctx.response.status = 404
        } else {
          theone.log.error('Call action exception,  href:"%s", body:%s\n%s', ctx.href, ctx.request.rawBody, e.stack)
          ctx.response.status = 500
        }
        if (ctx.app.errorHandlers.parsePath) await ctx.app.errorHandlers.parsePath(e, ctx)
        return
      }
      return next()
    }
  },

  //返回 koa Middleware
  callAction(middlewares) {
    return async function callAction(ctx, next) {
      try {
        let { moduleName, ctrl, action, _args } = ctx.pathInfo
        let args = Object.assign({}, ctx.query, ctx.request.body || {}, _args)
        let rt = await controller._callAction(ctx, middlewares, moduleName, ctrl, action, args)
        // ctx.actionResponse = rt
        rt.send(ctx)
        await next()
      } catch (e) {
        if (e instanceof RequestError) { //RequestError 属于外部调用错误，只记录 debug 日志
          ctx.response.status = 400
          theone.log.debug('Call action exception,  href:"%s", body:%s\n%s', ctx.href, ctx.request.rawBody, e.stack)
        } else {
          ctx.response.status = 500
          theone.log.error('Call action exception,  href:"%s", body:%s\n%s', ctx.href, ctx.request.rawBody, e.stack)
        }
        if (ctx.app.errorHandlers.callAction) await ctx.app.errorHandlers.callAction(e, ctx)
      }
    }
  }
}

module.exports = controller