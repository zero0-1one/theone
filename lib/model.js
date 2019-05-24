'use strict'

const theone = require('..')
const fs = require('fs')
const path = require('path')


let allModles = undefined
module.exports = {
  extends(parent) {
    return class extends parent {
      constructor(ctrl) {
        super(ctrl)
        this.ctrl = ctrl
        for (let options of theone.config['database']) {
          this[options.name] = ctrl[options.name]
        }
      }
    }
  },

  loadModle(dir, modelPath = '', data = {}) {
    let files = fs.readdirSync(dir)
    for (let file of files) {
      let filePath = path.join(dir, file)
      let stat = fs.statSync(filePath)
      if (file.endsWith('.js') && stat.isFile()) {
        let m = path.basename(filePath, '.js')
        data[modelPath + m] = this.extends(require(filePath))
      } else if (stat.isDirectory()) {
        this.loadModle(filePath, modelPath + file + '/', data)
      }
    }
    return data
  },

  creatModle(ctrl, name) {
    if (!allModles) {
      allModles = this.loadModle(theone.path(theone.config['modelDir']))
    }
    return new allModles[name](ctrl)
  },
}