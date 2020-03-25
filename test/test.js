'use strict'
let theone = require('..')
const path = require('path')

// 独立模块测试, 与测试顺序无关
describe('modules', function () {
  require('./util_test')
  require('./config_test')
  require('./controller_test')
  require('./log_test')
  require('./db_test')
  require('./fileCache_test')
  require('./memoryCache_test')
  require('./cache_test')
})
//theone 服务器的测试 
describe('theone', function () {
  let app
  describe('create no namespace', function () {
    it('start', async function () {
      const env = {
        NAMESPACE: '',
        //只有 ROOT_DIR 是绝对路径, 其他所有 路径配置都是相对 ROOT_DIR 的路径 使用 path.join(ROOT_DIR, other)
        ROOT_DIR: path.join(__dirname, './test_server'),
        DEBUG: true
      }
      app = await theone.create(env)
      app.runHttp()
    })
  })
  require('./request_test')
  require('./server_test')

  describe('shut down', function () {
    //等一下服务器完成启动才能关闭服务器
    it('waiting', function (done) {
      setTimeout(done, 2000)
    })

    it('close', async function () {
      await theone.shutdown()
    })
  })
})