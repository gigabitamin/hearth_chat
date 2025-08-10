from django.core.management.base import BaseCommand
from django.db import connection
from django.core.management import call_command
from django.db.migrations.executor import MigrationExecutor
from django.db import connections
import os

class Command(BaseCommand):
    help = '데이터베이스 연결과 마이그레이션 상태를 진단합니다'

    def handle(self, *args, **options):
        self.stdout.write('🔍 데이터베이스 진단 시작...\n')
        
        # 1. 환경 정보
        self.stdout.write('📋 환경 정보:')
        self.stdout.write(f'  - RENDER: {os.environ.get("RENDER", "false")}')
        self.stdout.write(f'  - RAILWAY_ENVIRONMENT: {os.environ.get("RAILWAY_ENVIRONMENT", "false")}')
        self.stdout.write(f'  - DATABASE_URL: {os.environ.get("DATABASE_URL", "Not Set")}')
        
        # 2. 데이터베이스 연결 테스트
        self.stdout.write('\n🔌 데이터베이스 연결 테스트:')
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT version();")
                version = cursor.fetchone()
                self.stdout.write(f'  ✅ 연결 성공: {version[0]}')
                
                # 테이블 목록 확인
                cursor.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    ORDER BY table_name;
                """)
                tables = cursor.fetchall()
                self.stdout.write(f'  📊 테이블 수: {len(tables)}')
                if tables:
                    self.stdout.write('  📋 테이블 목록:')
                    for table in tables[:10]:  # 처음 10개만 표시
                        self.stdout.write(f'    - {table[0]}')
                    if len(tables) > 10:
                        self.stdout.write(f'    ... 및 {len(tables) - 10}개 더')
                        
        except Exception as e:
            self.stdout.write(f'  ❌ 연결 실패: {e}')
            return
        
        # 3. 마이그레이션 상태 확인
        self.stdout.write('\n🔄 마이그레이션 상태 확인:')
        try:
            # showmigrations 명령 실행
            from io import StringIO
            from django.core.management import call_command
            
            output = StringIO()
            call_command('showmigrations', stdout=output, verbosity=0)
            migrations_output = output.getvalue()
            
            if migrations_output:
                self.stdout.write('  📋 마이그레이션 상태:')
                lines = migrations_output.strip().split('\n')
                for line in lines:
                    if line.strip():
                        self.stdout.write(f'    {line}')
            else:
                self.stdout.write('  ⚠️ 마이그레이션 정보를 가져올 수 없습니다')
                
        except Exception as e:
            self.stdout.write(f'  ❌ 마이그레이션 상태 확인 실패: {e}')
        
        # 4. 특정 모델 테이블 확인
        self.stdout.write('\n🗃️ 주요 모델 테이블 확인:')
        try:
            with connection.cursor() as cursor:
                # User 모델 테이블
                cursor.execute("""
                    SELECT COUNT(*) FROM auth_user;
                """)
                user_count = cursor.fetchone()[0]
                self.stdout.write(f'  👤 사용자 수: {user_count}')
                
                # Site 모델 테이블
                cursor.execute("""
                    SELECT COUNT(*) FROM django_site;
                """)
                site_count = cursor.fetchone()[0]
                self.stdout.write(f'  🌐 사이트 수: {site_count}')
                
                # Chat 모델 테이블들 (존재하는 경우)
                try:
                    cursor.execute("""
                        SELECT COUNT(*) FROM chat_room;
                    """)
                    room_count = cursor.fetchone()[0]
                    self.stdout.write(f'  💬 채팅방 수: {room_count}')
                except:
                    self.stdout.write('  💬 채팅방 테이블: 존재하지 않음')
                
                try:
                    cursor.execute("""
                        SELECT COUNT(*) FROM chat_message;
                    """)
                    message_count = cursor.fetchone()[0]
                    self.stdout.write(f'  💭 메시지 수: {message_count}')
                except:
                    self.stdout.write('  💭 메시지 테이블: 존재하지 않음')
                    
        except Exception as e:
            self.stdout.write(f'  ❌ 모델 테이블 확인 실패: {e}')
        
        # 5. 데이터베이스 설정 확인
        self.stdout.write('\n⚙️ 데이터베이스 설정:')
        from django.conf import settings
        db_settings = settings.DATABASES.get('default', {})
        self.stdout.write(f'  - ENGINE: {db_settings.get("ENGINE", "Not Set")}')
        self.stdout.write(f'  - NAME: {db_settings.get("NAME", "Not Set")}')
        self.stdout.write(f'  - HOST: {db_settings.get("HOST", "Not Set")}')
        self.stdout.write(f'  - PORT: {db_settings.get("PORT", "Not Set")}')
        self.stdout.write(f'  - USER: {db_settings.get("USER", "Not Set")}')
        
        self.stdout.write('\n✅ 데이터베이스 진단 완료!') 