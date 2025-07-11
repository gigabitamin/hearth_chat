"""
MySQL 연결 시 강제로 utf8mb4를 사용하는 커스텀 백엔드
"""
from django.db.backends.mysql.base import DatabaseWrapper as MySQLDatabaseWrapper
from django.db.backends.mysql.base import DatabaseFeatures as MySQLDatabaseFeatures
from django.db.backends.mysql.base import DatabaseOperations as MySQLDatabaseOperations
from django.db.backends.mysql.base import DatabaseIntrospection as MySQLDatabaseIntrospection
from django.db.backends.mysql.base import DatabaseSchemaEditor as MySQLDatabaseSchemaEditor

class DatabaseFeatures(MySQLDatabaseFeatures):
    pass

class DatabaseOperations(MySQLDatabaseOperations):
    pass

class DatabaseIntrospection(MySQLDatabaseIntrospection):
    pass

class DatabaseSchemaEditor(MySQLDatabaseSchemaEditor):
    pass

class DatabaseWrapper(MySQLDatabaseWrapper):
    def get_connection_params(self):
        """MySQL 연결 시 강제로 utf8mb4 설정"""
        params = super().get_connection_params()
        
        # 강제로 utf8mb4 설정
        if 'OPTIONS' not in params:
            params['OPTIONS'] = {}
        
        # 문자셋 강제 설정
        params['OPTIONS']['charset'] = 'utf8mb4'
        params['OPTIONS']['use_unicode'] = True
        
        # 연결 시 실행할 명령어들
        init_commands = [
            "SET character_set_client=utf8mb4",
            "SET character_set_connection=utf8mb4", 
            "SET character_set_results=utf8mb4",
            "SET collation_connection=utf8mb4_unicode_ci",
            "SET NAMES utf8mb4",
            "SET sql_mode='STRICT_TRANS_TABLES'"
        ]
        
        if 'init_command' in params['OPTIONS']:
            params['OPTIONS']['init_command'] += '; ' + '; '.join(init_commands)
        else:
            params['OPTIONS']['init_command'] = '; '.join(init_commands)
        
        return params 