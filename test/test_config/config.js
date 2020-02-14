'use strict'

module.exports = {
  'port': 17503,
  'database': {
    'name': 'db',
    'host': '127.0.0.1',
    'connectionLimit': 10,
  },
  'modules': [
    { 'name': 'api', 'mainDb': 'db' },
    { 'name': 'admin', 'mainDb': 'db' },
  ],
  'root_a': 1,
  'root_b': [
    1, 2, 3
  ]
}