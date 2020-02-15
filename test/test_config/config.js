'use strict'

module.exports = {
  'port': 17503,
  'database': {
    'name': 'db',
    'host': '127.0.0.1',
    'connectionLimit': 10,
  },
  'modules': [
    { 'name': 'api', 'database': 'db' },
    { 'name': 'admin', 'database': 'db' },
  ],
  'root_a': 1,
  'root_b': [
    1, 2, 3
  ]
}