const fs = require('fs')
const fsPromises = fs.promises
const path = require('path')
const toUtil = require('../util')
const { isMainThread } = require('worker_threads')

module.exports = class FileCache {
  constructor(options) {
    this.options = options
    this._gcing = false
    this.tags = {} //记录哪些 tags 已经初始化(已经创建目录)
    this._initDirs(this.options['dir'])
    this._mkDirs(path.join(this.options['dir'], '_tags_'))
  }

  key(name) {
    return toUtil.sha1(name)
  }

  _getDir(tag) {
    let dir = tag ? path.join(this.options['dir'], '_tags_', tag) : this.options['dir']
    if (tag && !toUtil.hasOwnPropertySafe(this.tags, tag)) {
      this._initDirs(dir) //只有第一次访问的 tag 会进入分支, 所以调用同步的 _initDirs 不会影响性能
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

  _rmdir(dirPath) {
    let files = []
    if (!fs.existsSync(dirPath)) return
    files = fs.readdirSync(dirPath)
    for (const file of files) {
      let curPath = path.join(dirPath, file)
      if (fs.statSync(curPath).isDirectory()) {
        this._rmdir(curPath)
      } else {
        fs.unlinkSync(curPath)
      }
    }
    fs.rmdirSync(dirPath)
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

  async tryTimes(cb, times = 3) {
    for (let i = 0; i < times - 1; i++) {
      try {
        return await cb()
      } catch (e) {
        await toUtil.sleep(10)
      }
    }
    return await cb() // 最后一次 不捕获异常
  }

  async clear(name, tag) {
    return this.tryTimes(async () => {
      let key = this.key(name)
      let dir = this._getDir(tag)
      await fsPromises.unlink(path.join(dir, key.substring(0, 2), key + '.json')).catch(e => {
        if (e.code != 'ENOENT') throw e
      })
    })
  }

  async clearTag(tag) {
    let dir = this._getDir(tag)
    let tasks = []
    let lastError = null
    return this.tryTimes(async () => {
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
              } catch (e) {
                lastError = e
              } //尽可能清理更多, 延迟报错
            }
          })
        }
      }
      tasks = tasks.map(t => t())
      await Promise.all(tasks).catch(e => (lastError = e))
      if (lastError) throw lastError
    })
  }

  async get(name, tag) {
    return this.tryTimes(async () => {
      let key = this.key(name)
      let dir = this._getDir(tag)
      let str = await fsPromises.readFile(path.join(dir, key.substring(0, 2), key + '.json'), 'utf8').catch(e => {
        if (e.code != 'ENOENT') throw e
      })
      if (str) return JSON.parse(str)
    })
  }

  async set(name, data, tag) {
    return this.tryTimes(async () => {
      let key = this.key(name)
      let dir = this._getDir(tag)
      await fsPromises.writeFile(path.join(dir, key.substring(0, 2), key + '.json'), JSON.stringify(data))
    })
  }

  async _gc(isExpired, dir, parts) {
    let tasks = []
    let fileNum = 0
    let clearNum = 0
    for (const name of parts) {
      tasks.push(async () => {
        let dirPath = path.join(dir, name)
        let files = await fsPromises.readdir(dirPath)
        fileNum += files.length
        for (let file of files) {
          try {
            let filePath = path.join(dirPath, file)
            if (!(await fsPromises.stat(filePath)).isFile()) {
              fileNum--
              continue
            }
            let str = await fsPromises.readFile(filePath, 'utf8')
            let data = JSON.parse(str)
            if (isExpired(data)) {
              await fsPromises.unlink(filePath)
              clearNum++
            }
          } catch (e) {}
        }
      })
    }

    tasks = tasks.map(t => t())
    await Promise.all(tasks).catch(() => {})
    return fileNum - clearNum
  }

  getGcParts(part) {
    let parts = []
    for (let d of '0123456789abcdef') {
      for (let d2 of '0123456789abcdef') {
        parts.push(d + d2)
      }
    }
    if (part) {
      let begin = (part[0] / part[1]) * parts.length
      let end = ((part[0] + 1) / part[1]) * parts.length
      return parts.slice(begin, end)
    }
    return parts
  }

  async clearEmptyTag(dir, tag, part) {
    let isEmpty = true
    if (part) {
      //部分gc 在最有一个 part 时检查全部是否为空
      if (part[0] == part[1] - 1) {
        for (let i = 0; i < part[1]; i++) {
          let p = this.getGcParts([i, part[1]])
          for (const name of p) {
            let files = await fsPromises.readdir(path.join(dir, name))
            if (files.length > 0) {
              isEmpty = false
              break
            }
          }
          if (!isEmpty) break
        }
      }
    }
    if (isEmpty) {
      delete this.tags[tag]
      this._rmdir(dir) //删除已经是空的 tag文件夹 （通常为历史残留）
    }
  }

  // gc 不抛异常
  async gc(isExpired, part) {
    if (!isMainThread || this._gcing) return //worker 线程不执行 文件gc
    this._gcing = true
    try {
      let parts = this.getGcParts(part)
      await this._gc(isExpired, this.options['dir'], parts)
      let tagsDir = path.join(this.options['dir'], '_tags_')
      let files = await fsPromises.readdir(tagsDir)
      for (let file of files) {
        try {
          let dir = path.join(tagsDir, file)
          if (!(await fsPromises.stat(dir)).isDirectory()) continue
          let fileNum = await this._gc(isExpired, dir, parts)
          if (fileNum == 0) await this.clearEmptyTag(dir, file, part)
        } catch (e) {
          //尽可能多的清除过期缓存
        }
      }
    } catch (e) {
      //尽可能多的清除过期缓存
    } finally {
      this._gcing = false
    }
  }
}
