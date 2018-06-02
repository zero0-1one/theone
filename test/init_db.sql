#部署 theone 测试环境,需要使用 mysql 的 root 账号执行以下 sql 指令

# set global general_log=ON;   #需要显示sql 日志时候使用, 每次重启 mysql 后失效


# DROP DATABASE theone_test;
# DROP DATABASE theone_log_test;

CREATE DATABASE IF NOT EXISTS `theone_test`;
CREATE DATABASE IF NOT EXISTS `theone_log_test`;

CREATE USER 'theone_tester'@'localhost' IDENTIFIED BY '12345';
GRANT ALL PRIVILEGES ON `theone_test`.* TO 'theone_tester'@'localhost';
GRANT ALL PRIVILEGES ON `theone_log_test`.* TO 'theone_tester'@'localhost';




###### theone_test ########################################

USE theone_test;

DROP TABLE IF EXISTS test_table;
CREATE TABLE test_table (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  k CHAR(8),
  v INT,
  PRIMARY KEY (id)
) ENGINE = innodb;





###### theone_log_test ####################################

USE theone_log_test;

DROP TABLE IF EXISTS log_table;
CREATE TABLE log_table (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  msg VARCHAR(8),
  PRIMARY KEY (id)
) ENGINE = innodb;