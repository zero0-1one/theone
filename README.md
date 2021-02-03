# Theone-server

Theone 不是为了做一个大而全的服务器框架，  
Theone 是专门为中小型 App 打造的 API 服务器框架。它基于 koa2，全面使用 ES6/7 语法编写。

# Theone 功能特色

- 参数按名称绑定、类型验证、类型转换
- 多模块
- 自动事务
- 多版本管理，自动继承
- 无模型，sql 编程高效、易优化
- 支持 Worker 线程，密集计算不阻塞
- 多端口、http、https 支持
- 其他常规功能：jwt、session、cache、log、定时任务等

## 使用

```
npm install zo-theone  --save
```

如下快速实现：http://localhost:18510/api/index/foo/id/123?time=2018-05-10T04:50

```js
//  api/index.js
module.exports = class {
  async foo_Action(id = Number, name = 'default', time = Date) {
    assert(typeof id == 'number' && id == 123)
    assert(typeof name == 'string' && name == 'default')
    assert(time instanceof Date && time.valueOf() == new Date('2018-05-10T04:50').valueOf())
    return { id }
  }
}
```

## Theone 的含义

对于绝大部分中小型服务器，通常我们不会变更数据库、改变配置表类型、需要多种返回类型等。我们需要的是高效、简洁、易上手、好维护。
对于每个模块都只选择了最常用的一种技术。

数据库：Theone 只支持 mysql；

模型：无。Theone 只支持 sql 模式操作数据库；

配置表：Theone 只支持 js；

返回类型：Theone 内置默认 json；

## 文档撰写中....

敬请期待
