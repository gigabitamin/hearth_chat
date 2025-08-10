"""
Django MySQL 연결을 강제로 utf8mb4로 설정하는 스크립트
"""
import os
import sys
import django
from django.conf import settings
from django.db import connections
from django.db.backends.mysql.base import DatabaseWrapper

# Django 설정 로드
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hearth_chat.settings')
django.setup()

def force_utf8mb4_connection():
    """MySQL 연결을 강제로 utf8mb4로 설정"""
    try:
        # 데이터베이스 연결 가져오기
        connection = connections['default']
        
        # 연결이 닫혀있으면 다시 열기
        if connection.connection is None:
            connection.ensure_connection()
        
        # 커서 생성
        cursor = connection.cursor()
        
        # utf8mb4 강제 설정
        utf8mb4_commands = [
            "SET character_set_client=utf8mb4",
            "SET character_set_connection=utf8mb4",
            "SET character_set_results=utf8mb4", 
            "SET collation_connection=utf8mb4_unicode_ci",
            "SET NAMES utf8mb4",
            "SET sql_mode='STRICT_TRANS_TABLES'"
        ]
        
        print("MySQL 연결을 utf8mb4로 강제 설정 중...")
        for command in utf8mb4_commands:
            cursor.execute(command)
            # print(f"✓ {command}")
        
        # 설정 확인
        cursor.execute("SHOW VARIABLES LIKE 'character_set%'")
        results = cursor.fetchall()
        
        print("\n현재 문자셋 설정:")
        # for var, value in results:
            # print(f"  {var}: {value}")
        
        cursor.close()
        # print("\n✅ MySQL 연결 utf8mb4 강제 설정 완료!")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

if __name__ == "__main__":
    force_utf8mb4_connection() 