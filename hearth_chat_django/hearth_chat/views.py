from django.views.generic import View
from django.http import HttpResponse
import os
import requests
from django.shortcuts import redirect
from django.utils import timezone
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.kakao.views import KakaoOAuth2Adapter
from allauth.socialaccount.providers.naver.views import NaverOAuth2Adapter
from allauth.socialaccount.providers.github.views import GitHubOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from allauth.socialaccount.models import SocialApp
from django.conf import settings
from django.http import JsonResponse
from allauth.socialaccount.models import SocialAccount
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.shortcuts import render
from allauth.socialaccount.models import SocialToken, SocialAccount
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from urllib.parse import urlencode


@ensure_csrf_cookie
def get_csrf_token(request):
    """CSRF 토큰을 제공하는 엔드포인트"""
    return JsonResponse({'detail': 'CSRF cookie set'})


class ReactAppView(View):
    def get(self, request):
        try:
            react_index_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "../hearth_chat_react/build/index.html"
            )
            with open(react_index_path, encoding="utf-8") as f:
                return HttpResponse(f.read())
        except FileNotFoundError:
            return HttpResponse(
                "React build 파일이 없습니다. 프론트엔드 빌드 후 다시 시도하세요.",
                status=501,
            ) 
            
def google_login_redirect(request):
    """Google OAuth 직접 리디렉션 (allauth 중간창 우회, 구버전 호환)"""
    try:
        app = SocialApp.objects.get(provider='google', sites=settings.SITE_ID)
        # 직접 callback URL 사용 (Google Cloud Console에 등록된 URL)
        callback_url = 'http://localhost:8000/oauth/google/callback/'
        print('[DEBUG][GOOGLE] callback_url:', callback_url)
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            'scope': 'openid profile email',
            'access_type': 'online',
        }
        print('[DEBUG][GOOGLE] auth_params:', params)
        url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        print('[DEBUG][GOOGLE] redirect_url:', url)
        return redirect(url)
    except SocialApp.DoesNotExist:
        print('[DEBUG][GOOGLE] SocialApp DoesNotExist')
        return HttpResponse("Google OAuth 설정이 필요합니다. Django Admin에서 SocialApp을 확인해주세요.", status=500)
    except Exception as e:
        print('[DEBUG][GOOGLE] Exception:', e)
        return HttpResponse(f"OAuth 리디렉션 오류: {str(e)}", status=500)

def kakao_login_redirect(request):
    """Kakao OAuth 직접 리디렉션 (allauth 중간창 우회)"""
    try:
        app = SocialApp.objects.get(provider='kakao', sites=settings.SITE_ID)
        # 직접 callback URL 사용
        callback_url = 'http://localhost:8000/oauth/kakao/callback/'
        print('[DEBUG][KAKAO] callback_url:', callback_url)
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            # 'scope': 'profile_nickname profile_image account_email', # 동의항목에서 account_email 설정 불가능
            'scope': 'profile_nickname profile_image',
        }
        print('[DEBUG][KAKAO] auth_params:', params)
        url = f"https://kauth.kakao.com/oauth/authorize?{urlencode(params)}"
        print('[DEBUG][KAKAO] redirect_url:', url)
        return redirect(url)
    except SocialApp.DoesNotExist:
        print('[DEBUG][KAKAO] SocialApp DoesNotExist')
        return HttpResponse("Kakao OAuth 설정이 필요합니다. Django Admin에서 SocialApp을 확인해주세요.", status=500)
    except Exception as e:
        print('[DEBUG][KAKAO] Exception:', e)
        return HttpResponse(f"OAuth 리디렉션 오류: {str(e)}", status=500)

def kakao_login_callback(request):
    """Kakao OAuth callback 직접 처리"""
    try:
        print('[DEBUG][KAKAO_CALLBACK] callback 처리 시작')
        print('[DEBUG][KAKAO_CALLBACK] request.GET:', dict(request.GET))
        
        code = request.GET.get('code')
        if not code:
            print('[DEBUG][KAKAO_CALLBACK] code가 없음')
            return HttpResponse("인증 코드가 없습니다.", status=400)
        
        # SocialApp 가져오기
        app = SocialApp.objects.get(provider='kakao', sites=settings.SITE_ID)
        print('[DEBUG][KAKAO_CALLBACK] SocialApp:', app.name)
        
        # Kakao OAuth2 API를 직접 호출하여 토큰 교환
        import requests
        
        token_url = 'https://kauth.kakao.com/oauth/token'
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': app.client_id,
            'client_secret': app.secret,
            'code': code,
            'redirect_uri': 'http://localhost:8000/oauth/kakao/callback/'
        }
        
        print('[DEBUG][KAKAO_CALLBACK] token_data:', token_data)
        token_response = requests.post(token_url, data=token_data)
        print('[DEBUG][KAKAO_CALLBACK] token_response.status_code:', token_response.status_code)
        print('[DEBUG][KAKAO_CALLBACK] token_response.text:', token_response.text)
        
        if token_response.status_code != 200:
            print('[DEBUG][KAKAO_CALLBACK] 토큰 교환 실패')
            return HttpResponse(f"토큰 교환 실패: {token_response.text}", status=400)
        
        token_info = token_response.json()
        access_token = token_info.get('access_token')
        print('[DEBUG][KAKAO_CALLBACK] access_token received')
        
        # Kakao User Info API를 사용하여 사용자 정보 요청
        user_info_url = 'https://kapi.kakao.com/v2/user/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(user_info_url, headers=headers)
        
        if user_response.status_code != 200:
            print('[DEBUG][KAKAO_CALLBACK] 사용자 정보 요청 실패')
            return HttpResponse(f"사용자 정보 요청 실패: {user_response.text}", status=400)
        
        user_info = user_response.json()
        print('[DEBUG][KAKAO_CALLBACK] user_info:', user_info)
        
        # 사용자 생성 또는 로그인
        from django.contrib.auth.models import User
        from allauth.socialaccount.models import SocialAccount
        
        # 카카오 계정 정보에서 이메일 추출
        kakao_account = user_info.get('kakao_account', {})
        email = kakao_account.get('email')
        
        # 이메일이 없는 경우 카카오 ID로 임시 이메일 생성
        if not email:
            print('[DEBUG][KAKAO_CALLBACK] 이메일 정보가 없음, 임시 이메일 생성')
            kakao_id = user_info.get('id')
            email = f"kakao_{kakao_id}@kakao.temp"
        else:
            print('[DEBUG][KAKAO_CALLBACK] 이메일 정보 확인:', email)
        
        # 이메일로 기존 사용자 찾기
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': f"kakao_{user_info.get('id')}",
                'first_name': kakao_account.get('profile', {}).get('nickname', ''),
            }
        )
        
        if created:
            print('[DEBUG][KAKAO_CALLBACK] 새 사용자 생성:', user.username)
        else:
            print('[DEBUG][KAKAO_CALLBACK] 기존 사용자 로그인:', user.username)
        
        # SocialAccount 생성 또는 업데이트
        social_account, created = SocialAccount.objects.get_or_create(
            provider='kakao',
            uid=str(user_info.get('id')),
            defaults={'user': user}
        )
        
        if not created:
            social_account.user = user
            social_account.save()
        
        # 로그인 처리
        from django.contrib.auth import login
        from django.contrib.auth.backends import ModelBackend
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        print('[DEBUG][KAKAO_CALLBACK] 사용자 로그인 완료:', user.username)
        
        # 팝업창 닫기 페이지로 리디렉션
        print('[DEBUG][KAKAO_CALLBACK] 팝업창 닫기 페이지로 리디렉션 시작')
        return redirect('/accounts/popup-close/')
        
    except Exception as e:
        print('[DEBUG][KAKAO_CALLBACK] Exception:', e)
        import traceback
        traceback.print_exc()
        return HttpResponse(f"OAuth callback 처리 오류: {str(e)}", status=500)

def naver_login_redirect(request):
    """Naver OAuth 직접 리디렉션 (allauth 중간창 우회)"""
    try:
        app = SocialApp.objects.get(provider='naver', sites=settings.SITE_ID)
        # 직접 callback URL 사용
        callback_url = 'http://localhost:8000/oauth/naver/callback/'
        print('[DEBUG][NAVER] callback_url:', callback_url)
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            'state': 'naver_state',  # 실제로는 CSRF 방지용 랜덤값 추천
            'scope': 'name email',
        }
        print('[DEBUG][NAVER] auth_params:', params)
        url = f"https://nid.naver.com/oauth2.0/authorize?{urlencode(params)}"
        print('[DEBUG][NAVER] redirect_url:', url)
        return redirect(url)
    except SocialApp.DoesNotExist:
        print('[DEBUG][NAVER] SocialApp DoesNotExist')
        return HttpResponse("Naver OAuth 설정이 필요합니다. Django Admin에서 SocialApp을 확인해주세요.", status=500)
    except Exception as e:
        print('[DEBUG][NAVER] Exception:', e)
        return HttpResponse(f"OAuth 리디렉션 오류: {str(e)}", status=500)

def naver_login_callback(request):
    """Naver OAuth callback 직접 처리"""
    try:
        print('[DEBUG][NAVER_CALLBACK] callback 처리 시작')
        print('[DEBUG][NAVER_CALLBACK] request.GET:', dict(request.GET))
        
        code = request.GET.get('code')
        state = request.GET.get('state')
        
        if not code:
            print('[DEBUG][NAVER_CALLBACK] code가 없음')
            return HttpResponse("인증 코드가 없습니다.", status=400)
        
        # SocialApp 가져오기
        app = SocialApp.objects.get(provider='naver', sites=settings.SITE_ID)
        print('[DEBUG][NAVER_CALLBACK] SocialApp:', app.name)
        
        # Naver OAuth2 API를 직접 호출하여 토큰 교환
        import requests
        
        token_url = 'https://nid.naver.com/oauth2.0/token'
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': app.client_id,
            'client_secret': app.secret,
            'code': code,
            'state': state
        }
        
        print('[DEBUG][NAVER_CALLBACK] token_data:', token_data)
        token_response = requests.post(token_url, data=token_data)
        print('[DEBUG][NAVER_CALLBACK] token_response.status_code:', token_response.status_code)
        print('[DEBUG][NAVER_CALLBACK] token_response.text:', token_response.text)
        
        if token_response.status_code != 200:
            print('[DEBUG][NAVER_CALLBACK] 토큰 교환 실패')
            return HttpResponse(f"토큰 교환 실패: {token_response.text}", status=400)
        
        token_info = token_response.json()
        access_token = token_info.get('access_token')
        print('[DEBUG][NAVER_CALLBACK] access_token received')
        
        # Naver User Info API를 사용하여 사용자 정보 요청
        user_info_url = 'https://openapi.naver.com/v1/nid/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(user_info_url, headers=headers)
        
        if user_response.status_code != 200:
            print('[DEBUG][NAVER_CALLBACK] 사용자 정보 요청 실패')
            return HttpResponse(f"사용자 정보 요청 실패: {user_response.text}", status=400)
        
        user_info = user_response.json()
        print('[DEBUG][NAVER_CALLBACK] user_info:', user_info)
        
        # 사용자 생성 또는 로그인
        from django.contrib.auth.models import User
        from allauth.socialaccount.models import SocialAccount
        
        # 네이버 계정 정보에서 이메일 추출
        response = user_info.get('response', {})
        email = response.get('email')
        
        # 이메일이 없는 경우 네이버 ID로 임시 이메일 생성
        if not email:
            print('[DEBUG][NAVER_CALLBACK] 이메일 정보가 없음, 임시 이메일 생성')
            naver_id = response.get('id')
            email = f"naver_{naver_id}@naver.temp"
        else:
            print('[DEBUG][NAVER_CALLBACK] 이메일 정보 확인:', email)
        
        # 이메일로 기존 사용자 찾기
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': f"naver_{response.get('id')}",
                'first_name': response.get('name', ''),
            }
        )
        
        if created:
            print('[DEBUG][NAVER_CALLBACK] 새 사용자 생성:', user.username)
        else:
            print('[DEBUG][NAVER_CALLBACK] 기존 사용자 로그인:', user.username)
        
        # SocialAccount 생성 또는 업데이트
        social_account, created = SocialAccount.objects.get_or_create(
            provider='naver',
            uid=response.get('id'),
            defaults={'user': user}
        )
        
        if not created:
            social_account.user = user
            social_account.save()
        
        # 로그인 처리
        from django.contrib.auth import login
        from django.contrib.auth.backends import ModelBackend
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        print('[DEBUG][NAVER_CALLBACK] 사용자 로그인 완료:', user.username)
        
        # 팝업창 닫기 페이지로 리디렉션
        print('[DEBUG][NAVER_CALLBACK] 팝업창 닫기 페이지로 리디렉션 시작')
        return redirect('/accounts/popup-close/')
        
    except Exception as e:
        print('[DEBUG][NAVER_CALLBACK] Exception:', e)
        import traceback
        traceback.print_exc()
        return HttpResponse(f"OAuth callback 처리 오류: {str(e)}", status=500)

def github_login_redirect(request):
    """GitHub OAuth 직접 리디렉션 (allauth 중간창 우회)"""
    try:
        app = SocialApp.objects.get(provider='github', sites=settings.SITE_ID)
        # 직접 callback URL 사용
        callback_url = 'http://localhost:8000/oauth/github/callback/'
        print('[DEBUG][GITHUB] callback_url:', callback_url)
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'scope': 'user:email',
        }
        print('[DEBUG][GITHUB] auth_params:', params)
        url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
        print('[DEBUG][GITHUB] redirect_url:', url)
        return redirect(url)
    except SocialApp.DoesNotExist:
        print('[DEBUG][GITHUB] SocialApp DoesNotExist')
        return HttpResponse("Github OAuth 설정이 필요합니다. Django Admin에서 SocialApp을 확인해주세요.", status=500)
    except Exception as e:
        print('[DEBUG][GITHUB] Exception:', e)
        return HttpResponse(f"OAuth 리디렉션 오류: {str(e)}", status=500)

def github_login_callback(request):
    """GitHub OAuth callback 직접 처리 (로그인 전용)"""
    try:
        print('[DEBUG][GITHUB_CALLBACK] callback 처리 시작')
        print('[DEBUG][GITHUB_CALLBACK] request.GET:', dict(request.GET))
        
        code = request.GET.get('code')
        
        if not code:
            print('[DEBUG][GITHUB_CALLBACK] code가 없음')
            return HttpResponse("인증 코드가 없습니다.", status=400)
        
        # SocialApp 가져오기
        app = SocialApp.objects.get(provider='github', sites=settings.SITE_ID)
        print('[DEBUG][GITHUB_CALLBACK] SocialApp:', app.name)
        
        # GitHub OAuth2 API를 직접 호출하여 토큰 교환
        import requests
        
        token_url = 'https://github.com/login/oauth/access_token'
        token_data = {
            'client_id': app.client_id,
            'client_secret': app.secret,
            'code': code,
        }
        headers = {'Accept': 'application/json'}
        
        print('[DEBUG][GITHUB_CALLBACK] token_data:', token_data)
        token_response = requests.post(token_url, data=token_data, headers=headers)
        print('[DEBUG][GITHUB_CALLBACK] token_response.status_code:', token_response.status_code)
        print('[DEBUG][GITHUB_CALLBACK] token_response.text:', token_response.text)
        
        if token_response.status_code != 200:
            print('[DEBUG][GITHUB_CALLBACK] 토큰 교환 실패')
            return HttpResponse(f"토큰 교환 실패: {token_response.text}", status=400)
        
        token_info = token_response.json()
        access_token = token_info.get('access_token')
        print('[DEBUG][GITHUB_CALLBACK] access_token received')
        
        # GitHub User Info API를 사용하여 사용자 정보 요청
        user_info_url = 'https://api.github.com/user'
        headers = {
            'Authorization': f'token {access_token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        user_response = requests.get(user_info_url, headers=headers)
        
        if user_response.status_code != 200:
            print('[DEBUG][GITHUB_CALLBACK] 사용자 정보 요청 실패')
            return HttpResponse(f"사용자 정보 요청 실패: {user_response.text}", status=400)
        
        user_info = user_response.json()
        print('[DEBUG][GITHUB_CALLBACK] user_info:', user_info)
        
        # GitHub User Email API를 사용하여 이메일 정보 요청
        email_url = 'https://api.github.com/user/emails'
        email_response = requests.get(email_url, headers=headers)
        
        if email_response.status_code != 200:
            print('[DEBUG][GITHUB_CALLBACK] 이메일 정보 요청 실패')
            return HttpResponse(f"이메일 정보 요청 실패: {email_response.text}", status=400)
        
        emails = email_response.json()
        print('[DEBUG][GITHUB_CALLBACK] emails:', emails)
        
        # 기본 이메일 찾기
        primary_email = None
        for email_info in emails:
            if email_info.get('primary') and email_info.get('verified'):
                primary_email = email_info.get('email')
                break
        
        # 기본 이메일이 없는 경우 GitHub username으로 임시 이메일 생성
        if not primary_email:
            print('[DEBUG][GITHUB_CALLBACK] 기본 이메일 정보가 없음, 임시 이메일 생성')
            github_username = user_info.get('login')
            primary_email = f"{github_username}@github.temp"
        else:
            print('[DEBUG][GITHUB_CALLBACK] 이메일 정보 확인:', primary_email)
        
        # 로그인 모드: 사용자 생성 또는 로그인
        print('[DEBUG][GITHUB_CALLBACK] 로그인 모드: 사용자 생성 또는 로그인')
        from django.contrib.auth.models import User
        from allauth.socialaccount.models import SocialAccount
        
        # 이메일로 기존 사용자 찾기
        user, created = User.objects.get_or_create(
            email=primary_email,
            defaults={
                'username': f"github_{user_info.get('login')}",
                'first_name': user_info.get('name', ''),
            }
        )
        
        if created:
            print('[DEBUG][GITHUB_CALLBACK] 새 사용자 생성:', user.username)
        else:
            print('[DEBUG][GITHUB_CALLBACK] 기존 사용자 로그인:', user.username)
        
        # SocialAccount 생성 또는 업데이트
        social_account, created = SocialAccount.objects.get_or_create(
            provider='github',
            uid=str(user_info.get('id')),
            defaults={'user': user}
        )
        
        if not created:
            social_account.user = user
            social_account.save()
        
        # 로그인 처리
        from django.contrib.auth import login
        from django.contrib.auth.backends import ModelBackend
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        print('[DEBUG][GITHUB_CALLBACK] 사용자 로그인 완료:', user.username)
    
        # 팝업창 닫기 페이지로 리디렉션
        print('[DEBUG][GITHUB_CALLBACK] 팝업창 닫기 페이지로 리디렉션 시작')
        return redirect('/accounts/popup-close/')
        
    except Exception as e:
        print('[DEBUG][GITHUB_CALLBACK] Exception:', e)
        import traceback
        traceback.print_exc()
        return HttpResponse(f"OAuth callback 처리 오류: {str(e)}", status=500)

def google_login_callback(request):
    """Google OAuth callback 직접 처리"""
    try:
        print('[DEBUG][GOOGLE_CALLBACK] callback 처리 시작')
        print('[DEBUG][GOOGLE_CALLBACK] request.GET:', dict(request.GET))
        
        code = request.GET.get('code')
        if not code:
            print('[DEBUG][GOOGLE_CALLBACK] code가 없음')
            return HttpResponse("인증 코드가 없습니다.", status=400)
        
        # SocialApp 가져오기
        app = SocialApp.objects.get(provider='google', sites=settings.SITE_ID)
        print('[DEBUG][GOOGLE_CALLBACK] SocialApp:', app.name)
        
        # Google OAuth2 API를 직접 호출하여 토큰 교환
        import requests
        
        token_url = 'https://oauth2.googleapis.com/token'
        token_data = {
            'client_id': app.client_id,
            'client_secret': app.secret,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': 'http://localhost:8000/oauth/google/callback/'
        }
        
        print('[DEBUG][GOOGLE_CALLBACK] token_data:', token_data)
        token_response = requests.post(token_url, data=token_data)
        print('[DEBUG][GOOGLE_CALLBACK] token_response.status_code:', token_response.status_code)
        print('[DEBUG][GOOGLE_CALLBACK] token_response.text:', token_response.text)
        
        if token_response.status_code != 200:
            print('[DEBUG][GOOGLE_CALLBACK] 토큰 교환 실패')
            return HttpResponse(f"토큰 교환 실패: {token_response.text}", status=400)
        
        token_info = token_response.json()
        access_token = token_info.get('access_token')
        print('[DEBUG][GOOGLE_CALLBACK] access_token received')
        
        # Google User Info API를 사용하여 사용자 정보 요청
        user_info_url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(user_info_url, headers=headers)
        
        if user_response.status_code != 200:
            print('[DEBUG][GOOGLE_CALLBACK] 사용자 정보 요청 실패')
            return HttpResponse(f"사용자 정보 요청 실패: {user_response.text}", status=400)
        
        user_info = user_response.json()
        print('[DEBUG][GOOGLE_CALLBACK] user_info:', user_info)
        
        # 사용자 생성 또는 로그인
        from django.contrib.auth.models import User
        from allauth.socialaccount.models import SocialAccount
        
        # 이메일로 기존 사용자 찾기
        email = user_info.get('email')
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': user_info.get('name', email.split('@')[0]),
                'first_name': user_info.get('given_name', ''),
                'last_name': user_info.get('family_name', ''),
            }
        )
        
        if created:
            print('[DEBUG][GOOGLE_CALLBACK] 새 사용자 생성:', user.username)
        else:
            print('[DEBUG][GOOGLE_CALLBACK] 기존 사용자 로그인:', user.username)
        
        # SocialAccount 생성 또는 업데이트
        social_account, created = SocialAccount.objects.get_or_create(
            provider='google',
            uid=user_info.get('id'),
            defaults={'user': user}
        )
        
        if not created:
            social_account.user = user
            social_account.save()
        
        # 로그인 처리
        from django.contrib.auth import login
        from django.contrib.auth.backends import ModelBackend
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        print('[DEBUG][GOOGLE_CALLBACK] 사용자 로그인 완료:', user.username)
        
        # 팝업창 닫기 페이지로 리디렉션
        print('[DEBUG][GOOGLE_CALLBACK] 팝업창 닫기 페이지로 리디렉션 시작')
        return redirect('/accounts/popup-close/')
        
    except Exception as e:
        print('[DEBUG][GOOGLE_CALLBACK] Exception:', e)
        import traceback
        traceback.print_exc()
        return HttpResponse(f"OAuth callback 처리 오류: {str(e)}", status=500)

@login_required
def social_connections_api(request):
    if request.method == 'GET':
        # 소셜 계정 목록 조회
        accounts = SocialAccount.objects.filter(user=request.user)
        data = [
            {
                'provider': acc.provider,
                'uid': acc.uid,
                'extra_data': acc.extra_data,
            }
            for acc in accounts
        ]
        return JsonResponse({'social_accounts': data})
    
    elif request.method == 'POST':
        # 소셜 계정 해제
        from django.views.decorators.csrf import csrf_exempt
        from django.utils.decorators import method_decorator
        
        action = request.POST.get('action')
        account = request.POST.get('account')
        
        if action == 'disconnect' and account:
            try:
                # 해당 소셜 계정 찾기
                social_account = SocialAccount.objects.get(
                    user=request.user,
                    provider=account
                )
                social_account.delete()
                return JsonResponse({'status': 'success', 'message': '계정 연결이 해제되었습니다.'})
            except SocialAccount.DoesNotExist:
                return JsonResponse({'status': 'error', 'message': '연결된 계정을 찾을 수 없습니다.'}, status=404)
            except Exception as e:
                return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
        else:
            return JsonResponse({'status': 'error', 'message': '잘못된 요청입니다.'}, status=400)
    
    return JsonResponse({'status': 'error', 'message': '지원하지 않는 메서드입니다.'}, status=405)

@login_required
def social_login_redirect_view(request):
    """소셜 로그인 성공 후 팝업창에서 postMessage를 보내고 닫기"""
    try:
        # 사용자의 소셜 계정 정보 가져오기
        social_account = SocialAccount.objects.filter(user=request.user).first()
        if social_account:
            token = SocialToken.objects.get(account=social_account)
            user_data = {
                "username": request.user.username,
                "email": request.user.email,
                "provider": social_account.provider,
                "token": token.token,
            }
        else:
            user_data = {
                "username": request.user.username,
                "email": request.user.email,
                "provider": "unknown",
                "token": None,
            }
    except SocialToken.DoesNotExist:
        user_data = {
            "username": request.user.username,
            "email": request.user.email,
            "provider": "unknown",
            "token": None,
        }

    return render(request, "social_login_redirect.html", {"user_data": user_data})

# 계정 연결용 뷰들
@login_required
def google_connect_redirect(request):
    """Google OAuth 계정 연결 리디렉션"""
    try:
        app = SocialApp.objects.get(provider='google', sites=settings.SITE_ID)
        callback_url = 'http://localhost:8000/oauth/google/connect/callback/'
        print('[DEBUG][GOOGLE_CONNECT] callback_url:', callback_url)
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            'scope': 'openid profile email',
            'access_type': 'online',
            'state': 'connect',  # 연결 모드임을 나타내는 state
        }
        print('[DEBUG][GOOGLE_CONNECT] auth_params:', params)
        url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        print('[DEBUG][GOOGLE_CONNECT] redirect_url:', url)
        return redirect(url)
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'Google OAuth 앱이 설정되지 않았습니다.'}, status=400)
    except Exception as e:
        print('[ERROR][GOOGLE_CONNECT] 리디렉션 오류:', str(e))
        return JsonResponse({'error': 'OAuth 리디렉션 중 오류가 발생했습니다.'}, status=500)

@login_required
def google_connect_callback(request):
    """Google OAuth 계정 연결 콜백 처리"""
    code = request.GET.get('code')
    state = request.GET.get('state')
    
    if not code:
        return JsonResponse({'error': '인증 코드가 없습니다.'}, status=400)
    
    try:
        app = SocialApp.objects.get(provider='google', sites=settings.SITE_ID)
        
        # 액세스 토큰 교환
        token_url = 'https://oauth2.googleapis.com/token'
        token_data = {
            'client_id': app.client_id,
            'client_secret': app.secret,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': 'http://localhost:8000/oauth/google/connect/callback/',
        }
        
        token_response = requests.post(token_url, data=token_data)
        token_response.raise_for_status()
        token_info = token_response.json()
        access_token = token_info['access_token']
        
        # 사용자 정보 가져오기
        user_info_url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(user_info_url, headers=headers)
        user_response.raise_for_status()
        user_info = user_response.json()
        
        # 기존 사용자에게 소셜 계정 연결
        social_account, created = SocialAccount.objects.get_or_create(
            provider='google',
            uid=user_info['id'],
            defaults={'user': request.user}
        )
        
        if not created:
            # 이미 다른 사용자에게 연결된 경우
            if social_account.user != request.user:
                return JsonResponse({'error': '이 Google 계정은 이미 다른 사용자에게 연결되어 있습니다.'}, status=400)
        
        # 토큰 저장
        if created:
            # expires_in을 정수로 변환
            expires_in = int(token_info.get('expires_in', 3600))
            SocialToken.objects.create(
                account=social_account,
                token=access_token,
                expires_at=timezone.now() + timezone.timedelta(seconds=expires_in)
            )
        
        return redirect('/accounts/popup-close/?action=connect')
        
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'Google OAuth 앱이 설정되지 않았습니다.'}, status=400)
    except requests.RequestException as e:
        print('[ERROR][GOOGLE_CONNECT] API 요청 오류:', str(e))
        return JsonResponse({'error': 'OAuth API 요청 중 오류가 발생했습니다.'}, status=500)
    except Exception as e:
        print('[ERROR][GOOGLE_CONNECT] 콜백 처리 오류:', str(e))
        return JsonResponse({'error': 'OAuth 콜백 처리 중 오류가 발생했습니다.'}, status=500)

@login_required
def kakao_connect_redirect(request):
    """Kakao OAuth 계정 연결 리디렉션"""
    try:
        app = SocialApp.objects.get(provider='kakao', sites=settings.SITE_ID)
        callback_url = 'http://localhost:8000/oauth/kakao/connect/callback/'
        print('[DEBUG][KAKAO_CONNECT] callback_url:', callback_url)
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            'scope': 'profile_nickname profile_image',
        }
        print('[DEBUG][KAKAO_CONNECT] auth_params:', params)
        url = f"https://kauth.kakao.com/oauth/authorize?{urlencode(params)}"
        print('[DEBUG][KAKAO_CONNECT] redirect_url:', url)
        return redirect(url)
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'Kakao OAuth 앱이 설정되지 않았습니다.'}, status=400)
    except Exception as e:
        print('[ERROR][KAKAO_CONNECT] 리디렉션 오류:', str(e))
        return JsonResponse({'error': 'OAuth 리디렉션 중 오류가 발생했습니다.'}, status=500)

@login_required
def kakao_connect_callback(request):
    """Kakao OAuth 계정 연결 콜백 처리"""
    code = request.GET.get('code')
    if not code:
        return JsonResponse({'error': '인증 코드가 없습니다.'}, status=400)
    
    try:
        app = SocialApp.objects.get(provider='kakao', sites=settings.SITE_ID)
        
        # 액세스 토큰 교환
        token_url = 'https://kauth.kakao.com/oauth/token'
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': app.client_id,
            'client_secret': app.secret,
            'code': code,
            'redirect_uri': 'http://localhost:8000/oauth/kakao/connect/callback/',
        }
        
        token_response = requests.post(token_url, data=token_data)
        token_response.raise_for_status()
        token_info = token_response.json()
        access_token = token_info['access_token']
        
        # 사용자 정보 가져오기
        user_info_url = 'https://kapi.kakao.com/v2/user/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(user_info_url, headers=headers)
        user_response.raise_for_status()
        user_info = user_response.json()
        
        # 기존 사용자에게 소셜 계정 연결
        social_account, created = SocialAccount.objects.get_or_create(
            provider='kakao',
            uid=str(user_info['id']),
            defaults={'user': request.user}
        )
        
        if not created:
            # 이미 다른 사용자에게 연결된 경우
            if social_account.user != request.user:
                return JsonResponse({'error': '이 Kakao 계정은 이미 다른 사용자에게 연결되어 있습니다.'}, status=400)
        
        # 토큰 저장
        if created:
            # expires_in을 정수로 변환
            expires_in = int(token_info.get('expires_in', 21600))
            SocialToken.objects.create(
                account=social_account,
                token=access_token,
                expires_at=timezone.now() + timezone.timedelta(seconds=expires_in)
            )
        
        return redirect('/accounts/popup-close/?action=connect')
        
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'Kakao OAuth 앱이 설정되지 않았습니다.'}, status=400)
    except requests.RequestException as e:
        print('[ERROR][KAKAO_CONNECT] API 요청 오류:', str(e))
        return JsonResponse({'error': 'OAuth API 요청 중 오류가 발생했습니다.'}, status=500)
    except Exception as e:
        print('[ERROR][KAKAO_CONNECT] 콜백 처리 오류:', str(e))
        return JsonResponse({'error': 'OAuth 콜백 처리 중 오류가 발생했습니다.'}, status=500)

@login_required
def naver_connect_redirect(request):
    """Naver OAuth 계정 연결 리디렉션"""
    try:
        app = SocialApp.objects.get(provider='naver', sites=settings.SITE_ID)
        callback_url = 'http://localhost:8000/oauth/naver/connect/callback/'
        print('[DEBUG][NAVER_CONNECT] callback_url:', callback_url)
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            'state': 'naver_connect_state',
            'scope': 'name email',
        }
        print('[DEBUG][NAVER_CONNECT] auth_params:', params)
        url = f"https://nid.naver.com/oauth2.0/authorize?{urlencode(params)}"
        print('[DEBUG][NAVER_CONNECT] redirect_url:', url)
        return redirect(url)
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'Naver OAuth 앱이 설정되지 않았습니다.'}, status=400)
    except Exception as e:
        print('[ERROR][NAVER_CONNECT] 리디렉션 오류:', str(e))
        return JsonResponse({'error': 'OAuth 리디렉션 중 오류가 발생했습니다.'}, status=500)

@login_required
def naver_connect_callback(request):
    """Naver OAuth 계정 연결 콜백 처리"""
    code = request.GET.get('code')
    state = request.GET.get('state')
    
    if not code:
        return JsonResponse({'error': '인증 코드가 없습니다.'}, status=400)
    
    try:
        app = SocialApp.objects.get(provider='naver', sites=settings.SITE_ID)
        
        # 액세스 토큰 교환
        token_url = 'https://nid.naver.com/oauth2.0/token'
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': app.client_id,
            'client_secret': app.secret,
            'code': code,
            'state': state,
        }
        
        token_response = requests.post(token_url, data=token_data)
        token_response.raise_for_status()
        token_info = token_response.json()
        access_token = token_info['access_token']
        
        # 사용자 정보 가져오기
        user_info_url = 'https://openapi.naver.com/v1/nid/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(user_info_url, headers=headers)
        user_response.raise_for_status()
        user_info = user_response.json()
        
        response = user_info.get('response', {})
        
        # 기존 사용자에게 소셜 계정 연결
        social_account, created = SocialAccount.objects.get_or_create(
            provider='naver',
            uid=response['id'],
            defaults={'user': request.user}
        )
        
        if not created:
            # 이미 다른 사용자에게 연결된 경우
            if social_account.user != request.user:
                return JsonResponse({'error': '이 Naver 계정은 이미 다른 사용자에게 연결되어 있습니다.'}, status=400)
        
        # 토큰 저장
        if created:
            # expires_in을 정수로 변환
            expires_in = int(token_info.get('expires_in', 3600))
            SocialToken.objects.create(
                account=social_account,
                token=access_token,
                expires_at=timezone.now() + timezone.timedelta(seconds=expires_in)
            )
        
        return redirect('/accounts/popup-close/?action=connect')
        
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'Naver OAuth 앱이 설정되지 않았습니다.'}, status=400)
    except requests.RequestException as e:
        print('[ERROR][NAVER_CONNECT] API 요청 오류:', str(e))
        return JsonResponse({'error': 'OAuth API 요청 중 오류가 발생했습니다.'}, status=500)
    except Exception as e:
        print('[ERROR][NAVER_CONNECT] 콜백 처리 오류:', str(e))
        return JsonResponse({'error': 'OAuth 콜백 처리 중 오류가 발생했습니다.'}, status=500)

@login_required
def github_connect_redirect(request):
    """GitHub OAuth 계정 연결 리디렉션"""
    try:
        app = SocialApp.objects.get(provider='github', sites=settings.SITE_ID)
        # 연결 전용 callback URL 사용
        callback_url = 'http://localhost:8000/oauth/github/connect/callback/'
        print('[DEBUG][GITHUB_CONNECT] callback_url:', callback_url)
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            'scope': 'read:user user:email',
        }
        print('[DEBUG][GITHUB_CONNECT] auth_params:', params)
        url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
        print('[DEBUG][GITHUB_CONNECT] redirect_url:', url)
        return redirect(url)
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'GitHub OAuth 앱이 설정되지 않았습니다.'}, status=400)
    except Exception as e:
        print('[ERROR][GITHUB_CONNECT] 리디렉션 오류:', str(e))
        return JsonResponse({'error': 'OAuth 리디렉션 중 오류가 발생했습니다.'}, status=500)

@login_required
def github_connect_callback(request):
    """GitHub OAuth 계정 연결 콜백 처리"""
    code = request.GET.get('code')
    
    if not code:
        return JsonResponse({'error': '인증 코드가 없습니다.'}, status=400)
    
    try:
        app = SocialApp.objects.get(provider='github', sites=settings.SITE_ID)
        
        # GitHub OAuth2 API를 직접 호출하여 토큰 교환
        token_url = 'https://github.com/login/oauth/access_token'
        token_data = {
            'client_id': app.client_id,
            'client_secret': app.secret,
            'code': code,
        }
        headers = {'Accept': 'application/json'}
        
        print('[DEBUG][GITHUB_CONNECT_CALLBACK] token_data:', token_data)
        token_response = requests.post(token_url, data=token_data, headers=headers)
        print('[DEBUG][GITHUB_CONNECT_CALLBACK] token_response.status_code:', token_response.status_code)
        print('[DEBUG][GITHUB_CONNECT_CALLBACK] token_response.text:', token_response.text)
        
        if token_response.status_code != 200:
            print('[DEBUG][GITHUB_CONNECT_CALLBACK] 토큰 교환 실패')
            return HttpResponse(f"토큰 교환 실패: {token_response.text}", status=400)
        
        token_info = token_response.json()
        access_token = token_info.get('access_token')
        print('[DEBUG][GITHUB_CONNECT_CALLBACK] access_token received')
        
        # GitHub User Info API를 사용하여 사용자 정보 요청
        user_info_url = 'https://api.github.com/user'
        headers = {
            'Authorization': f'token {access_token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        user_response = requests.get(user_info_url, headers=headers)
        
        if user_response.status_code != 200:
            print('[DEBUG][GITHUB_CONNECT_CALLBACK] 사용자 정보 요청 실패')
            return HttpResponse(f"사용자 정보 요청 실패: {user_response.text}", status=400)
        
        user_info = user_response.json()
        print('[DEBUG][GITHUB_CONNECT_CALLBACK] user_info:', user_info)
        
        # 기존 사용자에게 소셜 계정 연결
        social_account, created = SocialAccount.objects.get_or_create(
            provider='github',
            uid=str(user_info.get('id')),
            defaults={'user': request.user}
        )
        
        if not created:
            # 이미 다른 사용자에게 연결된 경우
            if social_account.user != request.user:
                return JsonResponse({'error': '이 GitHub 계정은 이미 다른 사용자에게 연결되어 있습니다.'}, status=400)
        
        # 토큰 저장
        if created:
            SocialToken.objects.create(
                account=social_account,
                token=access_token,
                expires_at=None  # GitHub 토큰은 만료되지 않음
            )
        
        print('[DEBUG][GITHUB_CONNECT_CALLBACK] connect 모드 완료')
        return redirect('/accounts/popup-close/?action=connect')
        
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'GitHub OAuth 앱이 설정되지 않았습니다.'}, status=400)
    except requests.RequestException as e:
        print('[ERROR][GITHUB_CONNECT_CALLBACK] API 요청 오류:', str(e))
        return JsonResponse({'error': 'OAuth API 요청 중 오류가 발생했습니다.'}, status=500)
    except Exception as e:
        print('[ERROR][GITHUB_CONNECT_CALLBACK] 콜백 처리 오류:', str(e))
        return JsonResponse({'error': 'OAuth 콜백 처리 중 오류가 발생했습니다.'}, status=500)


