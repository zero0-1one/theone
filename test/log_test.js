'use strict'

const log = require('../lib/log')
const { its } = require('zo-mocha-ext')

describe('log', function() {
  it('easy config - stdout', async function() {
    log.init({
      'level': 'INFO',
      'type': 'stdout'
    })


    log.mark('this is mark log')
    log.fatal('this is fatal log')
    log.error('this is error log')
    log.warn('this is warn log')
    log.info('this is info log')
    log.debug('this is debug %d log', 1)
    log.sql('this is sql log')
    log.trace('this log  will  not be show')
    await log.shutdown()
  })

  its(10, 'easy config - stdout', async function() {
    this.beforeAll(() => {
      this.timeout(5000)
      this.slow(5000)
      log.init({
        'level': 'DEBUG',
        'type': 'file',
        'file': {
          'filename': './test/test_log/test.log',
          'pattern': '_yyyy-MM-dd_hh-mm',
          'compress': false 
        }
      })
    })
    log.mark('this is mark log')
    log.fatal('this is fatal log')
    log.error('this is error log')
    log.warn('this is warn log')
    log.info('this is info log')
    log.debug('this is debug %d log', 1)
    log.sql('this is sql log')
    log.trace('this log  will  not be show')
    await new Promise(resolve => {
      setTimeout(resolve, 200)
    })
    await this.afterAll(async () => {
      await log.shutdown()
    })
  })

})