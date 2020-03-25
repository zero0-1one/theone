'use strict'

const fs = require('fs')
const fsPromises = fs.promises
const path = require('path')
const toUtil = require('../util')

module.exports = class FileCache {
  constructor(options) {
    this.options = options
    this._gcing = false
    this.tags = {}//记录哪些 tags 已经初始化(已经创建目录)
    this._initDirs(this.options['dir'])
    this._mkDirs(path.join(this.options['dir'], '_tags_'))
  }

  key(name) {
    return toUtil.sha1(name)
  }

  async _getDir(tag) {
    let dir = tag ? path.join(this.options['dir'], '_tags_', tag) : this.options['dir']
    if (tag && !this.tags.hasOwnProperty(tag)) {
      this._initDirs(dir)
      this.tags[tag] = true
    }
    return dir
  }

  _mkDirs(dirPath) {
    if (!fs.existsSync(dirPath)) {
      this._mkDirs(path.dirname(dirPath))
      fs.mkdirSync(dirPath)
    }
  }

  _initDirs(dir) {
    this._mkDirs(dir)
    for (let d of '0123456789abcdef') {
      for (let d2 of '0123456789abcdef') {
        let dirPath = path.join(dir, d + d2)
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath)
        }
      }
    }
  }

  async clear(name, tag) {
    let key = this.key(name)
    let dir = await this._getDir(tag)
    await fsPromises.unlink(path.join(dir, key.substring(0, 2), key + '.json'))
  }

  async clearTag(tag) {
    let dir = await this._getDir(tag)
    let tasks = []
    let lastError = null
    for (let d of '0123456789abcdef') {
      for (let d2 of '0123456789abcdef') {
        tasks.push(async () => {
          let dirPath = path.join(dir, d + d2)
          let files = await fsPromises.readdir(dirPath)
          for (let file of files) {
            try {
              let filePath = path.join(dirPath, file)
              if (!(await fsPromises.stat(filePath)).isFile()) continue
              await fsPromises.unlink(filePath)
            } catch (e) { lastError = e } //尽可能清理更多, 延迟报错
          }
        })
      }
    }
    tasks = tasks.map(t => t())
    await Promise.all(tasks).catch(e => lastError = e)
    if (lastError) throw lastError
  }

  async get(name, tag) {
    let key = this.key(name)
    let dir = await this._getDir(tag)
    let str = await fsPromises.readFile(path.join(dir, key.substring(0, 2), key + '.json'), 'utf8').catch(() => { })
    if (str) return JSON.parse(str)
  }

  async set(name, data, tag) {
    let key = this.key(name)
    let dir = await this._getDir(tag)
    await fsPromises.writeFile(path.join(dir, key.substring(0, 2), key + '.json'), JSON.stringify(data))
  }

  async _gc(isExpired, dir) {
    let tasks = []
    for (let d of '0123456789abcdef') {
      for (let d2 of '0123456789abcdef') {
        tasks.push(async () => {
          let dirPath = path.join(dir, d + d2)
          let files = await fsPromises.readdir(dirPath)
          for (let file of files) {
            try {
              let filePath = path.join(dirPath, file)
              if (!(await fsPromises.stat(filePath)).isFile()) continue
              let str = await fsPromises.readFile(filePath, 'utf8')
              let data = JSON.parse(str)
              if (isExpired(data)) await fsPromises.unlink(filePath)
            } catch (e) { }
          }
        })
      }
    }
    tasks = tasks.map(t => t())
    await Promise.all(tasks).catch(() => { })
  }

  async gc(isExpired) {
    if (this._gcing) return
    this._gcing = true
    try {
      await this._gc(isExpired, this.options['dir'])
      let tagsDir = path.join(this.options['dir'], '_tags_')
      let files = await fsPromises.readdir(tagsDir)
      for (let file of files) {
        let dir = path.join(tagsDir, file)
        if (!(await fsPromises.stat(dir)).isDirectory()) continue
        await this._gc(isExpired, dir)
      }
    } finally {
      this._gcing = false
    }
  }
}
