const theone = require('./theone')
const toUtil = require('./util')
const util = require('util')
const fs = require('fs')
const path = require('path')
const compareVersions = require('compare-versions')
const compose = require('koa-compose')
const { sign, verify } = require('jsonwebtoken')
const model = require('./model')
const { Response, RequestError } = require('./response')

const _ctrls = Symbol('controllers')
const _inject = Symbol('controller inject map')
const _injectData = Symbol('set inject map function')
const _models = Symbol('models')
const _init = Symbol('controller init')
const _mainDb = Symbol('main db')
const _newInModel = Symbol.for('new in model()')
const _caches = Symbol('action caches')

let allModules = undefined
let controller = {
  extends(parent) {
    return class extends parent {
      constructor(ctx, args) {
        super(ctx, args)
        this.ctx = ctx
        if (!ctx.rootCtrl) ctx.rootCtrl = this //入口 ctrl
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
        if (!toUtil.hasOwnPropertySafe(this[_models], name)) {
          let models = allModules[this.module][_models]
          if (!toUtil.hasOwnPropertySafe(models, name)) throw new Error(`当前模块不存在 '${name}' model`)
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
        if (!toUtil.hasOwnPropertySafe(this[_ctrls], name)) {
          let ctrl = controller.getCtrl(this.module, name, this.version)
          this[_ctrls][name] = new ctrl.class(this.ctx, this.args)
          this[_ctrls][name][_init]()
        }
        return this[_ctrls][name]
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

      async jwtSign(data, expiresIn) {
        let cfg = theone.config['jwt']
        let options = Object.assign({}, cfg['options'])
        if (expiresIn) options.expiresIn = expiresIn
        let token = await util.promisify(sign)(data, cfg['secret'], options)
        if (token.length > 512) {
          theone.log.warn('JWT 数据太大, 不要把它当成数据缓存. data:' + JSON.stringify(data).slice(0, 200) + '...')
        }
        return token
      }

      async jwtVerify(token) {
        let cfg = theone.config['jwt']
        let data = await util.promisify(verify)(token, cfg['secret'])
        return data
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
      if (name.endsWith(suffix) && (name.startsWith('_') || toUtil.hasOwnPropertySafe(ownerPro, '_' + name))) {
        continue
      }
      if (!toUtil.hasOwnPropertySafe(ownerPro, name)) {
        ownerPro[name] = lastPro[name]
      }
    }

    //继承静态方法或属性
    let names = Object.getOwnPropertyNames(lastVersion.rawClass)
    for (const name of names) {
      if (name != 'length' && name != 'prototype' && !toUtil.hasOwnPropertySafe(owner, name)) {
        owner[name] = lastVersion.rawClass[name]
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
    if (dir && typeof ctrlClass.middleware == 'function') {
      //静态方法定义 middleware
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
    if (typeof owner != 'function') return data // 不是 class
    ctrlName = ctrlName.slice(0, ctrlName.length - 1)
    if (lastVersion && lastVersion[ctrlName]) {
      owner = this.inheritLastVersion(owner, suffix, lastVersion[ctrlName])
    }
    let names = Object.getOwnPropertyNames(owner.prototype)
    let ctrl = (data[ctrlName] = {})
    inject.name = ctrl.name = ctrlName
    ctrl.rawClass = owner
    ctrl.class = this.extends(owner)
    this.injectPrototype(ctrl.class, inject)
    ctrl.actions = {}
    for (let action of names) {
      if (typeof owner.prototype[action] != 'function') continue
      if (!action.startsWith('_') && action.endsWith(suffix)) {
        //找出action
        let actionName = action.slice(0, action.length - suffix.length)
        ctrl.actions[actionName] = {
          name: actionName,
          func: owner.prototype[action],
          params: toUtil.getMemberFunctionParams(owner.prototype[action]),
        }
      }
    }
    return data
  },

  _loadModule(moduleDir, options, ctrlName, data, lastVersion, inject) {
    let suffix = options['actionSuffix']
    let modelPath = options['internalModel']
      ? theone.pathNormalize(options['parentDir'], options['name'], theone.config['modelDir'])
      : ''
    fs.readdirSync(moduleDir).forEach(file => {
      if (file.startsWith('_')) return //所有以 '_' 开头的文件夹和文件都被过滤
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
      if (version.startsWith('_')) {
        //所有以 '_' 开头的文件夹和文件都被过滤
        return false
      }
      let versionDir = path.join(dir, version)
      return fs.statSync(versionDir).isDirectory() //version 是文件夹
    })
    versions.sort(compareVersions) //排序 先加载小版本
    let lastVersion = undefined
    for (const version of versions) {
      let isBelow = min && compareVersions(version, min) < 0
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
      if (!toUtil.hasOwnPropertySafe(module, version)) {
        throw new Error(`"${moduleName}" module does not have version: "${version}"`)
      }
      module = module[version]
    }
    if (!toUtil.hasOwnPropertySafe(module, ctrlName)) {
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
        let sortArgs = toUtil.getFunctionArgs(args, action.params, ({ msg }) => {
          throw new RequestError(msg)
        })
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
        await rt.send(ctx)
        return rt
      }
      if (allModules[moduleName]._autoTransaction) {
        let db = ctrlInst[_mainDb]
        await db.beginTransaction()
        let rt = await call().catch(e => {
          db.rollback()
          ctrlInst.cacheRollback()
          throw e
        })
        if (rt.isError()) {
          db.rollback()
          ctrlInst.cacheRollback()
        } else {
          db.commit()
        }
        return rt
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
          if (toUtil.hasOwnPropertySafe(module, names[0])) {
            version = names.shift()
          } else if (toUtil.hasOwnPropertySafe(ctx.query, 'version') && toUtil.hasOwnPropertySafe(module, ctx.query.version)) {
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
          if (toUtil.hasOwnPropertySafe(module, ctrlName) && toUtil.hasOwnPropertySafe(module[ctrlName].actions, actionName)) {
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
        if (e instanceof RequestError) {
          //RequestError 属于外部调用错误，只记录 debug 日志
          theone.log.debug('Call action exception, ip:"%s", href:"%s", body:%s\n%s', ctx.ip, ctx.href, ctx.request.rawBody, e.stack)
          ctx.response.status = 404
        } else {
          theone.log.error('Call action exception, ip:"%s", href:"%s", body:%s\n%s', ctx.ip, ctx.href, ctx.request.rawBody, e.stack)
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
        await controller._callAction(ctx, middlewares, moduleName, ctrl, action, args)
        await next()
      } catch (e) {
        if (e instanceof RequestError) {
          //RequestError 属于外部调用错误，只记录 debug 日志
          ctx.response.status = e.status
          theone.log.debug('Call action exception, ip:"%s", href:"%s", body:%s\n%s', ctx.ip, ctx.href, ctx.request.rawBody, e.stack)
        } else {
          ctx.response.status = 500
          theone.log.error('Call action exception, ip:"%s", href:"%s", body:%s\n%s', ctx.ip, ctx.href, ctx.request.rawBody, e.stack)
        }
        if (ctx.app.errorHandlers.callAction) await ctx.app.errorHandlers.callAction(e, ctx)
      }
    }
  },
}

module.exports = controller
