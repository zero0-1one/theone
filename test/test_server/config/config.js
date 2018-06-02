'use strict'

module.exports = {
  'port': 17503,

  'database': [{
    'name': 'db',
    'host': 'localhost',
    'user': 'theone_tester',
    'password': '12345',
    'database': 'theone_test',
    'connectionLimit': 5
  }, {
    'name': 'logdb',
    'host': 'localhost',
    'user': 'theone_tester',
    'password': '12345',
    'database': 'theone_log_test',
    'connectionLimit': 2
  }],

  'modules': [{
    'name': 'api'
  }, {
    'name': 'admin',
    'multiVersion': false,
    'autoTransaction': false
  }],

  'log': {
    'sqlLog': true
  }
}