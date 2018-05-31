'use strict'

const assert = require('chai').assert
const log = require('../lib/log')
const { its } = require('zo-mocha-ext')

describe('log', function() {
  xit('easy config - stdout', async function() {
    log.init({
      'level': 'DEBUG',
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
  })

  its(10, 'easy config - stdout', async function() {
    log.init({
      'level': 'DEBUG',
      'type': 'file',
      'filename': './test/test_log/test.log',
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
      setTimeout(resolve, 1000)
    })
  })


})