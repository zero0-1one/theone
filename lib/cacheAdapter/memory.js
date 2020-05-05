module.exports = class MemoryCache {
  constructor() {
    this._gcing = false
    this._data = {}
    this._tagData = {}
  }

  _getData(tag) {
    if (tag) {
      if (!this._tagData[tag]) this._tagData[tag] = {}
      return this._tagData[tag]
    }
    return this._data
  }

  clear(name, tag) {
    let data = this._getData(tag)
    delete data[name]
  }

  clearTag(tag) {
    delete this._tagData[tag]
  }

  get(name, tag) {
    let data = this._getData(tag)
    return data[name]
  }

  set(name, value, tag) {
    let data = this._getData(tag)
    data[name] = value
  }

  async gc(isExpired) {
    for (const name in this._data) {
      if (isExpired(this._data[name])) delete this._data[name]
    }
    for (const tag in this._tagData) {
      let data = this._tagData[tag]
      for (const name in data) {
        if (isExpired(data[name])) {
          delete data[name]
        }
      }
      let isEmpty = Object.keys(data).length == 0
      if (isEmpty) delete this._tagData[tag]
    }
  }
}
