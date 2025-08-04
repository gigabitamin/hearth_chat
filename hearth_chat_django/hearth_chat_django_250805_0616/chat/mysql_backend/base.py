"""
MySQL 커스텀 백엔드 - utf8mb4 문자셋 강제 설정
"""
from django.db.backends.mysql.base import DatabaseWrapper as MySQLDatabaseWrapper
from django.db.backends.mysql.base import DatabaseFeatures as MySQLDatabaseFeatures
from django.db.backends.mysql.base import DatabaseOperations as MySQLDatabaseOperations
from django.db.backends.mysql.base import DatabaseClient as MySQLDatabaseClient
from django.db.backends.mysql.base import DatabaseCreation as MySQLDatabaseCreation
from django.db.backends.mysql.base import DatabaseIntrospection as MySQLDatabaseIntrospection
from django.db.backends.mysql.base import DatabaseSchemaEditor as MySQLDatabaseSchemaEditor


class DatabaseFeatures(MySQLDatabaseFeatures):
    """MySQL 데이터베이스 기능 확장"""
    pass


class DatabaseOperations(MySQLDatabaseOperations):
    """MySQL 데이터베이스 작업 확장"""
    pass


class DatabaseClient(MySQLDatabaseClient):
    """MySQL 데이터베이스 클라이언트 확장"""
    pass


class DatabaseCreation(MySQLDatabaseCreation):
    """MySQL 데이터베이스 생성 확장"""
    pass


class DatabaseIntrospection(MySQLDatabaseIntrospection):
    """MySQL 데이터베이스 인트로스펙션 확장"""
    pass


class DatabaseSchemaEditor(MySQLDatabaseSchemaEditor):
    """MySQL 데이터베이스 스키마 에디터 확장"""
    pass


class DatabaseWrapper(MySQLDatabaseWrapper):
    """MySQL 커스텀 래퍼 - utf8mb4 강제 설정"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.features = DatabaseFeatures(self)
        self.ops = DatabaseOperations(self)
        self.client = DatabaseClient(self)
        self.creation = DatabaseCreation(self)
        self.introspection = DatabaseIntrospection(self)
        self.schema_editor = DatabaseSchemaEditor(self)
    
    def get_connection_params(self):
        """연결 파라미터에 utf8mb4 설정 추가 (Django 5.x 호환)"""
        params = super().get_connection_params()

        # self.settings_dict["OPTIONS"]에 직접 설정
        if "OPTIONS" not in self.settings_dict:
            self.settings_dict["OPTIONS"] = {}
        self.settings_dict["OPTIONS"]["charset"] = "utf8mb4"
        init_commands = [
            "SET character_set_client=utf8mb4",
            "SET character_set_connection=utf8mb4",
            "SET character_set_results=utf8mb4",
            "SET collation_connection=utf8mb4_unicode_ci",
            "SET NAMES utf8mb4",
            "SET sql_mode='STRICT_TRANS_TABLES'"
        ]
        if 'init_command' in self.settings_dict["OPTIONS"]:
            self.settings_dict["OPTIONS"]['init_command'] += '; ' + '; '.join(init_commands)
        else:
            self.settings_dict["OPTIONS"]['init_command'] = '; '.join(init_commands)

        print("✅ MySQL 커스텀 백엔드 연결 파라미터 설정 완료!")
        return params
    
    def ensure_connection(self):
        """연결 시 utf8mb4 강제 설정"""
        if self.connection is None:
            super().ensure_connection()
            
            # 연결 후 추가 utf8mb4 설정
            with self.cursor() as cursor:
                utf8mb4_commands = [
                    "SET character_set_client=utf8mb4",
                    "SET character_set_connection=utf8mb4",
                    "SET character_set_results=utf8mb4", 
                    "SET collation_connection=utf8mb4_unicode_ci",
                    "SET NAMES utf8mb4",
                    "SET sql_mode='STRICT_TRANS_TABLES'"
                ]
                
                for command in utf8mb4_commands:
                    cursor.execute(command)
                
                print("✅ MySQL 커스텀 백엔드 연결 후 utf8mb4 강제 설정 완료!")
        
        return self.connection 