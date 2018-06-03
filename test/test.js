'use strict'

let theone = require('..')
const path = require('path')

//独立模块测试, 与测试顺序无关
// require('./config_test')
// require('./controller_test')
// require('./log_test')
// require('./db_test')


//theone 服务器的测试 
describe('theone', function() {
  it('create no namespace', async function() {
  
    const env = {
      NAMESPACE: '',
      //只有 ROOT_DIR 是绝对路径, 其他所有 路径配置都是相对 ROOT_DIR 的路径 使用 path.join(ROOT_DIR, other)
      ROOT_DIR: path.join(__dirname, './test_server'),
      DEBUG: true
    }
    let app = theone.create(env)
    app.runHttp()
  })


})