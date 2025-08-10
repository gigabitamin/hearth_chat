from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.conf import settings
import os
import shutil
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Render 서버에서 안전하게 정적 파일을 수집합니다'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='기존 정적 파일을 모두 삭제합니다',
        )
        parser.add_argument(
            '--noinput',
            action='store_true',
            help='사용자 입력을 요청하지 않습니다',
        )

    def handle(self, *args, **options):
        self.stdout.write('🔄 안전한 정적 파일 수집을 시작합니다...')
        
        try:
            # 1. React 빌드 폴더 확인
            react_build_path = os.path.join(settings.BASE_DIR.parent, 'hearth_chat_react', 'build')
            if not os.path.exists(react_build_path):
                self.stdout.write(
                    self.style.ERROR(f'❌ React 빌드 폴더를 찾을 수 없습니다: {react_build_path}')
                )
                return
            
            self.stdout.write(f'✅ React 빌드 폴더 발견: {react_build_path}')
            
            # 2. 정적 파일 수집 디렉토리 준비
            static_root = getattr(settings, 'STATIC_ROOT', None)
            if not static_root:
                self.stdout.write(
                    self.style.ERROR('❌ STATIC_ROOT가 설정되지 않았습니다')
                )
                return
            
            # 기존 파일 삭제 (--clear 옵션)
            if options['clear'] and os.path.exists(static_root):
                shutil.rmtree(static_root)
                self.stdout.write(f'🗑️ 기존 정적 파일 삭제됨: {static_root}')
            
            # 디렉토리 생성
            os.makedirs(static_root, exist_ok=True)
            
            # 3. React 빌드 파일을 STATIC_ROOT로 직접 복사
            self.stdout.write('📁 React 빌드 파일을 정적 파일 디렉토리로 복사 중...')
            
            # 주요 파일들 복사
            files_to_copy = [
                'index.html',
                'favicon.ico',
                'manifest.json',
                'robots.txt',
                'logo.svg',
                'logo192.png',
                'logo512.png',
                'asset-manifest.json'
            ]
            
            for file_name in files_to_copy:
                src_path = os.path.join(react_build_path, file_name)
                dst_path = os.path.join(static_root, file_name)
                if os.path.exists(src_path):
                    shutil.copy2(src_path, dst_path)
                    self.stdout.write(f'  ✅ {file_name} 복사됨')
            
            # 폴더들 복사
            folders_to_copy = [
                'static',
                'avatar_glb',
                'avatar_motion_gltf', 
                'avatar_vrm',
                'face_detector',
                'oauth_logo'
            ]
            
            for folder_name in folders_to_copy:
                src_path = os.path.join(react_build_path, folder_name)
                dst_path = os.path.join(static_root, folder_name)
                if os.path.exists(src_path):
                    if os.path.isdir(dst_path):
                        shutil.rmtree(dst_path)
                    shutil.copytree(src_path, dst_path)
                    self.stdout.write(f'  ✅ {folder_name}/ 폴더 복사됨')
            
            # 4. Django 기본 정적 파일 수집 (선택적)
            try:
                self.stdout.write('🔄 Django 기본 정적 파일 수집 중...')
                call_command('collectstatic', 
                           '--noinput' if options['noinput'] else '',
                           '--clear=False',  # 이미 복사했으므로 다시 지우지 않음
                           verbosity=1)
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f'⚠️ Django 정적 파일 수집 중 오류 (무시됨): {e}')
                )
            
            # 5. 결과 확인
            total_files = sum([len(files) for r, d, files in os.walk(static_root)])
            self.stdout.write(
                self.style.SUCCESS(f'🎉 정적 파일 수집 완료! 총 {total_files}개 파일')
            )
            self.stdout.write(f'📁 정적 파일 위치: {static_root}')
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ 정적 파일 수집 중 오류 발생: {e}')
            )
            # 오류가 발생해도 서버는 시작할 수 있도록
            self.stdout.write('⚠️ 오류가 발생했지만 서버 시작을 계속합니다...') 