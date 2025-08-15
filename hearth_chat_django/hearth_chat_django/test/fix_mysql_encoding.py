#!/usr/bin/env python3
"""
MySQL 연결을 utf8mb4로 강제 설정하는 스크립트
"""

import mysql.connector
from mysql.connector import Error

def fix_mysql_encoding():
    try:
        # MySQL 연결
        connection = mysql.connector.connect(
            host='localhost',
            user='root',
            password='1234',
            database='hearth_chat_db',
            charset='utf8mb4',
            collation='utf8mb4_unicode_ci'
        )
        
        if connection.is_connected():
            cursor = connection.cursor()
            
            # 문자셋 설정 명령어들
            charset_commands = [
                "SET character_set_client = utf8mb4",
                "SET character_set_connection = utf8mb4", 
                "SET character_set_results = utf8mb4",
                "SET collation_connection = utf8mb4_unicode_ci",
                "SET NAMES utf8mb4",
                "SET sql_mode = 'STRICT_TRANS_TABLES'"
            ]
            
            # print("MySQL 문자셋 설정 중...")
            for command in charset_commands:
                cursor.execute(command)
                # print(f"✓ {command}")
            
            # 데이터베이스 문자셋 확인
            cursor.execute("SHOW VARIABLES LIKE 'character_set%'")
            results = cursor.fetchall()
            
            # print("\n현재 문자셋 설정:")
            # for var, value in results:
                # print(f"  {var}: {value}")
            
            # 테이블 문자셋 변경
            # print("\n테이블 문자셋 변경 중...")
            cursor.execute("ALTER TABLE chat_chat CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            # print("✓ chat_chat 테이블 문자셋 변경 완료")
            
            connection.commit()
            # print("\n✅ MySQL 문자셋 설정 완료!")
            
    except Error as e:
        print(f"❌ MySQL 연결 오류: {e}")
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()
            # print("MySQL 연결 종료")

if __name__ == "__main__":
    fix_mysql_encoding() 