'use strict'

const theone = require('..')
const fs = require('fs')
const path = require('path')
const getParamNames = require('@captemulation/get-parameter-names')
const modle = require('./modle')

const _modle = Symbol('controller modle')

module.exports = {
  extends(parent) {
    return class extends parent {
      constructor() {
        super()
        for (let options of theone.config['database']) {
          this[options.name] = new theone.env.DB_CLASS(options)
        }
        this[_modle] = {}
      }

      module(name) {
        if (!(name in this[_modle])) {
          this[_modle][name] = modle.creatModle(this, name)
        }
        return this[_modle][name]
      }
    }
  },

  loadController(controllerFile, suffix, actionPath, data = {}) {
    let owner = require(controllerFile)
    let names = Object.getOwnPropertyNames(owner.prototype)
    for (let action of names) {
      if (!action.startsWith('_') && action.endsWith(suffix)) { //找出action
        let a = action.substr(0, action.length - suffix.length)
        data[actionPath + a] = {
          owner: this.extends(owner),
          func: owner[action],
          params: getParamNames(owner.prototype[action])
        }
      }
    }
    return data
  },

  loadModule(moduleDir, suffix, actionPath = '', data = {}) {
    let files = fs.readdirSync(moduleDir)
    for (let file of files) {
      let filePath = path.join(moduleDir, file)
      let stat = fs.statSync(filePath)
      if (file.endsWith('.js') && stat.isFile()) {
        let c = path.basename(filePath, '.js')
        this.loadController(filePath, suffix, actionPath + c + '/', data)
      } else if (stat.isDirectory()) {
        this.loadModule(filePath, suffix, actionPath + file + '/', data)
      }
    }
    return data
  },

  loadVersions(dir, suffix) {
    let data = {}
    let versions = fs.readdirSync(dir)
    for (let version of versions) {
      let versionDir = path.join(dir, version)
      if (fs.statSync(versionDir).isDirectory()) { //version 是文件夹
        data[version] = this.loadModule(versionDir, suffix)
      }
    }
    return data
  },

  load() {
    let allActions = {}
    for (let options of theone.config['modules']) {
      let dir = path.join(theone.env.ROOT_DIR, options['parentDir'])
      if (options['multi_version']) {
        allActions[options.name] = this.loadVersions(dir, options['actionSuffix'])
      } else {
        allActions[options.name] = this.loadModule(dir, options['actionSuffix'])
      }
    }
    return allActions
  }
}