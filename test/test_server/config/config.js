'use strict'

module.exports = {
  'port': 19510,

  'database': [
    {
      'name': 'db',
      'host': 'localhost',
      'user': 'theone_tester',
      'password': '12345',
      'database': 'theone_test',
      'connectionLimit': 5,
    },
    {
      'name': 'logdb',
      'host': 'localhost',
      'user': 'theone_tester',
      'password': '12345',
      'database': 'theone_log_test',
      'connectionLimit': 2,
    },
  ],

  'modules': [
    {
      'name': 'api',
      'multiVersion': true,
      'middleware': ['midB', { name: 'midC', unless: ctrlName => ctrlName != 'hasMidC' }],
    },
    {
      'name': 'admin',
      'autoTransaction': false,
      'internalModel': true,
    },
  ],

  'log': {
    'type': 'file',
    'sqlLog': false,
  },

  'keys': ['adsfasdfahd#gfbn$', 'cads#@sdfadfv'],

  'jwt': {
    'enabled': true,
    'passthrough': true,
    'secret': 'asdfasdasdfas',
  },

  'session': {
    'enabled': true,
  },

  'workers': {
    'open': true,
    'name': 'test',
    'dir': './testWorker',
    'entry': './worker',
    'autorestart': true,
    'heartbeat': 1,

    'debug': true,
  },
}
