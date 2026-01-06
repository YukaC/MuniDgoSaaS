CREATE USER 'user_api_1'@'localhost' IDENTIFIED BY 'pass_user_1';

GRANT ALL PRIVILEGES ON ProyectoTurnos.* TO 'user_api_1'@'localhost' WITH GRANT OPTION;

SHOW GRANTS FOR 'user_api_1'@'localhost';