from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount


class Command(BaseCommand):
    help = '소셜 로그인 사용자들의 이메일을 자동으로 검증 상태로 업데이트합니다.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='실제 변경사항을 적용하지 않고 확인만 합니다.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN 모드 - 실제 변경사항이 적용되지 않습니다.'))
        
        # 소셜 계정이 있는 사용자들 찾기
        social_accounts = SocialAccount.objects.select_related('user').all()
        
        verified_count = 0
        created_count = 0
        
        for social_account in social_accounts:
            user = social_account.user
            provider = social_account.provider
            
            self.stdout.write(f'처리 중: {user.username} ({provider}) - {user.email}')
            
            if user.email:
                # 이메일 주소가 있는 경우
                email_address, created = EmailAddress.objects.get_or_create(
                    user=user,
                    email=user.email,
                    defaults={
                        'verified': True,
                        'primary': True
                    }
                )
                
                if created:
                    created_count += 1
                    self.stdout.write(f'  ✓ 새 이메일 주소 생성: {user.email}')
                else:
                    # 기존 이메일 주소가 검증되지 않은 경우 업데이트
                    if not email_address.verified:
                        if not dry_run:
                            email_address.verified = True
                            email_address.primary = True
                            email_address.save()
                        verified_count += 1
                        self.stdout.write(f'  ✓ 이메일 검증 상태 업데이트: {user.email}')
                    else:
                        self.stdout.write(f'  - 이미 검증됨: {user.email}')
            else:
                self.stdout.write(f'  - 이메일 주소 없음')
        
        # 요약 출력
        self.stdout.write('\n' + '='*50)
        self.stdout.write('처리 완료 요약:')
        self.stdout.write(f'총 소셜 계정 수: {social_accounts.count()}')
        self.stdout.write(f'새로 생성된 이메일 주소: {created_count}')
        self.stdout.write(f'검증 상태 업데이트: {verified_count}')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\nDRY RUN 모드였습니다. 실제 적용하려면 --dry-run 옵션을 제거하세요.'))
        else:
            self.stdout.write(self.style.SUCCESS('\n모든 소셜 로그인 사용자의 이메일이 검증 상태로 업데이트되었습니다.')) 