'use strict'

const theone = require('..')
const fs = require('fs')
const path = require('path')

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

      model(name) {
        return this.ctrl.model(name)
      }
    }
  },

  loadModel(dir, modelPath = '', data = {}) {
    let files = fs.readdirSync(dir)
    for (let file of files) {
      let filePath = path.join(dir, file)
      let stat = fs.statSync(filePath)
      if (file.endsWith('.js') && stat.isFile()) {
        let m = path.basename(filePath, '.js')
        data[modelPath + m] = this.extends(require(filePath))
      } else if (stat.isDirectory()) {
        this.loadModel(filePath, modelPath + file + '/', data)
      }
    }
    return data
  }
}

