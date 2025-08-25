from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from dotenv import load_dotenv
import os

load_dotenv()

class Command(BaseCommand):
    help = 'Create or update initial superuser for Railway/Render deploy'

    def handle(self, *args, **options):
        User = get_user_model()
        username = os.getenv('DJANGO_SUPERUSER_USERNAME')
        email = os.getenv('DJANGO_SUPERUSER_EMAIL')
        password = os.getenv('DJANGO_SUPERUSER_PASSWORD')
        
        self.stdout.write(f'🔧 슈퍼유저 생성/업데이트 시작...')
        self.stdout.write(f'  - Username: {username}')
        self.stdout.write(f'  - Email: {email}')
        
        try:
            user, created = User.objects.get_or_create(
                username=username, 
                defaults={'email': email}
            )
            
            if created:
                self.stdout.write(f'✅ 새 슈퍼유저 {username} 생성됨')
            else:
                self.stdout.write(f'📝 기존 슈퍼유저 {username} 발견됨')
            
            # 기존 사용자 정보 업데이트
            user.email = email
            user.is_superuser = True
            user.is_staff = True
            user.is_active = True
            user.set_password(password)
            user.save()
            
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'🎉 슈퍼유저 {username} 생성 완료!')
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(f'🔄 슈퍼유저 {username} 정보 업데이트 완료!')
                )
            
            # 생성된 사용자 정보 확인
            self.stdout.write(f'📋 사용자 정보:')
            self.stdout.write(f'  - ID: {user.id}')
            self.stdout.write(f'  - Username: {user.username}')
            self.stdout.write(f'  - Email: {user.email}')
            self.stdout.write(f'  - Is Superuser: {user.is_superuser}')
            self.stdout.write(f'  - Is Staff: {user.is_staff}')
            self.stdout.write(f'  - Is Active: {user.is_active}')
            self.stdout.write(f'  - Date Joined: {user.date_joined}')
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ 슈퍼유저 생성/업데이트 중 오류 발생: {e}')
            )
            raise 