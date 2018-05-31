#部署 theone 测试环境,需要使用 mysql 的 root 账号执行以下 sql 指令

# set global general_log=ON;   #需要显示sql 日志时候使用


#DROP DATABASE theone_test;
CREATE DATABASE IF NOT EXISTS `theone_test`;

CREATE USER 'theone_tester'@'localhost' IDENTIFIED BY '12345';
GRANT ALL PRIVILEGES ON `theone_test`.* TO 'theone_tester'@'localhost';

USE theone_test;

DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  k CHAR(8),
  v INT,
  PRIMARY KEY (id)
) ENGINE = innodb;
