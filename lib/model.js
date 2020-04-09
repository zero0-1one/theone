const zoUtil = require('../lib/util')
const fs = require('fs')
const path = require('path')

const _newInModel = Symbol.for('new in model()')

module.exports = {
  extends(parent, name) {
    return class extends parent {
      constructor(owner, mark) {
        if (mark === _newInModel) {
          super(owner)
          this.ctrl = owner
        } else {
          return owner.model(name)
        }
      }

      model(name) {
        return this.ctrl.model(name)
      }
    }
  },

  _replace(data) {
    let newModels = {}
    for (const name in data) {
      newModels[name] = zoUtil.replaceModule(data[name], (old) => this.extends(old, name))
    }
    return newModels
  },

  _loadModel(dir, modelPath = '', data = {}) {
    let files = fs.readdirSync(dir)
    for (let file of files) {
      let filePath = path.join(dir, file)
      let stat = fs.statSync(filePath)
      if (file.endsWith('.js') && stat.isFile()) {
        let name = modelPath + path.basename(filePath, '.js')
        data[name] = filePath
      } else if (stat.isDirectory()) {
        this._loadModel(filePath, modelPath + file + '/', data)
      }
    }
    return data
  },

  loadModel(dir, modelPath = '') {
    let data = this._loadModel(dir, modelPath)
    //需要循环多次,支持 model 内依赖其他 model 情况, 如果没有循环依赖, 将趋于稳定结果,
    //如果有循环依赖,则支持的层由这里的循环决定, 默认 5层
    let newModels = null
    for (let i = 0; i < 5; i++) {
      newModels = this._replace(data)
    }
    return newModels
  }
}
