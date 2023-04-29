const toUtil = require('../lib/util')
const fs = require('fs')
const path = require('path')

const _newInModel = Symbol.for('new in model()')
const _rememberData = Symbol.for('model remember data')

//已经加载的 models
let loadModels = {}

module.exports = {
  extends(parent, name) {
    return class extends parent {
      constructor(owner, mark) {
        if (mark === _newInModel) {
          super(owner)
          this.ctrl = owner
          this[_rememberData] = {}
          this.remember = new Proxy(this, {
            get: function (target, prop) {
              if (typeof target[prop] == 'function') {
                return function (...args) {
                  let keyStr = prop + toUtil.getKeyStr(args)
                  if (target[_rememberData][keyStr]) return target[_rememberData][keyStr]
                  let rt = target[prop](...args)
                  target[_rememberData][keyStr] = rt
                  return rt
                }
              } else {
                return target[prop]
              }
            },
          })
        } else {
          return owner.model(name)
        }
      }

      model(name) {
        return this.ctrl.model(name)
      }

      async cache(name, value, timeout) {
        return this.ctrl.cache(name, value, timeout)
      }
    }
  },

  _replace(data) {
    let newModels = {}
    for (const name in data) {
      newModels[name] = toUtil.replaceModule(data[name], old => this.extends(old, name))
    }
    return newModels
  },

  _loadModel(dir, modelPath = '', data = {}) {
    let files = fs.readdirSync(dir)
    for (let file of files) {
      let filePath = path.join(dir, file)
      let stat = fs.statSync(filePath)
      if (file.endsWith('.js') && stat.isFile()) {
        const suffix = file.endsWith('.model.js') ? '.model.js' : '.js'
        let name = modelPath + path.basename(filePath, suffix)
        data[name] = filePath
      } else if (stat.isDirectory()) {
        this._loadModel(filePath, modelPath + file + '/', data)
      }
    }
    return data
  },

  loadModel(dir, modelPath = '') {
    dir = path.normalize(dir)
    if (loadModels[dir]) return loadModels[dir] // 防止重复加载

    let data = this._loadModel(dir, modelPath)
    //需要循环多次,支持 model 内依赖其他 model 情况, 如果没有循环依赖, 将趋于稳定结果,
    //如果有循环依赖,则支持的层由这里的循环决定, 默认 5层
    let newModels = null
    for (let i = 0; i < 5; i++) {
      newModels = this._replace(data)
    }
    loadModels[dir] = newModels
    return newModels
  },
}
