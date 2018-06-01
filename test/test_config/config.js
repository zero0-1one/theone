'use strict'

module.exports = {
  'port': 17503,
  'database': {
    'host': '127.0.0.1',
    'connectionLimit': 10,
  },
  'modules': [
    { 'name': 'api' },
    { 'name': 'admin' }
  ],
  'root_a': 1,
  'root_b': [
    1, 2, 3
  ]
}