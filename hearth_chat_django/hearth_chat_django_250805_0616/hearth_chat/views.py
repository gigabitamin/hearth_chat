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
        callback_url = f'{settings.BASE_URL}/oauth/google/callback/'
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            'scope': 'openid profile email',
            'access_type': 'online',
            'prompt': 'select_account',  # 계정 선택 창 강제 표시
        }
        url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        return redirect(url)
    except SocialApp.DoesNotExist:
        return HttpResponse("Google OAuth 설정이 필요합니다. Django Admin에서 SocialApp을 확인해주세요.", status=500 ,json_dumps_params={'ensure_ascii': False})
    except Exception as e:
        return HttpResponse(f"OAuth 리디렉션 오류: {str(e)}", status=500 ,json_dumps_params={'ensure_ascii': False})

def kakao_login_redirect(request):
    """Kakao OAuth 직접 리디렉션 (allauth 중간창 우회)"""
    try:
        app = SocialApp.objects.get(provider='kakao', sites=settings.SITE_ID)
        # 직접 callback URL 사용
        callback_url = f'{settings.BASE_URL}/oauth/kakao/callback/'
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            # 'scope': 'profile_nickname profile_image account_email', # 동의항목에서 account_email 설정 불가능
            'scope': 'profile_nickname profile_image',
            'force_login': 'true',  # 계정 선택 창 강제 표시
        }
        url = f"https://kauth.kakao.com/oauth/authorize?{urlencode(params)}"
        return redirect(url)
    except SocialApp.DoesNotExist:
        return HttpResponse("Kakao OAuth 설정이 필요합니다. Django Admin에서 SocialApp을 확인해주세요.", status=500 ,json_dumps_params={'ensure_ascii': False})
    except Exception as e:
        return HttpResponse(f"OAuth 리디렉션 오류: {str(e)}", status=500 ,json_dumps_params={'ensure_ascii': False})

def kakao_login_callback(request):
    """Kakao OAuth callback 직접 처리"""
    try:
        code = request.GET.get('code')
        if not code:
            return HttpResponse("인증 코드가 없습니다.", status=400 ,json_dumps_params={'ensure_ascii': False})
        
        # SocialApp 가져오기
        app = SocialApp.objects.get(provider='kakao', sites=settings.SITE_ID)
        
        # Kakao OAuth2 API를 직접 호출하여 토큰 교환
        import requests
        
        token_url = 'https://kauth.kakao.com/oauth/token'
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': app.client_id,
            'client_secret': app.secret,
            'code': code,
            'redirect_uri': f'{settings.BASE_URL}/oauth/kakao/callback/'
        }
        
        token_response = requests.post(token_url, data=token_data)
        
        if token_response.status_code != 200:
            return HttpResponse(f"토큰 교환 실패: {token_response.text}", status=400)
        
        token_info = token_response.json()
        access_token = token_info.get('access_token')
        
        # Kakao User Info API를 사용하여 사용자 정보 요청
        user_info_url = 'https://kapi.kakao.com/v2/user/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(user_info_url, headers=headers)
        
        if user_response.status_code != 200:
            return HttpResponse(f"사용자 정보 요청 실패: {user_response.text}", status=400)
        
        user_info = user_response.json()
        
        # 사용자 생성 또는 로그인
        from django.contrib.auth.models import User
        from allauth.socialaccount.models import SocialAccount
        
        # 카카오 계정 정보에서 이메일 추출
        kakao_account = user_info.get('kakao_account', {})
        email = kakao_account.get('email')
        
        # 이메일이 없는 경우 카카오 ID로 임시 이메일 생성
        if not email:
            kakao_id = user_info.get('id')
            email = f"kakao_{kakao_id}@kakao.temp"
        
        # 이메일로 기존 사용자 찾기
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': f"kakao_{user_info.get('id')}",
                'first_name': kakao_account.get('profile', {}).get('nickname', ''),
            }
        )
        
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
        
        # 팝업창 닫기 페이지로 리디렉션
        return render(request, 'socialaccount/popup_close.html')
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return HttpResponse(f"OAuth callback 처리 오류: {str(e)}", status=500 ,json_dumps_params={'ensure_ascii': False})

def naver_login_redirect(request):
    """Naver OAuth 직접 리디렉션 (allauth 중간창 우회)"""
    try:
        app = SocialApp.objects.get(provider='naver', sites=settings.SITE_ID)
        # 직접 callback URL 사용
        callback_url = f'{settings.BASE_URL}/oauth/naver/callback/'
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            'state': 'naver_state',  # 실제로는 CSRF 방지용 랜덤값 추천
            'scope': 'name email',
            'auth_type': 'reauthenticate',  # 계정 선택 창 강제 표시
        }
        url = f"https://nid.naver.com/oauth2.0/authorize?{urlencode(params)}"
        return redirect(url)
    except SocialApp.DoesNotExist:
        return HttpResponse("Naver OAuth 설정이 필요합니다. Django Admin에서 SocialApp을 확인해주세요.", status=500 ,json_dumps_params={'ensure_ascii': False})
    except Exception as e:
        return HttpResponse(f"OAuth 리디렉션 오류: {str(e)}", status=500 ,json_dumps_params={'ensure_ascii': False})

def naver_login_callback(request):
    """Naver OAuth callback 직접 처리"""
    try:
        code = request.GET.get('code')
        state = request.GET.get('state')
        
        if not code:
            return HttpResponse("인증 코드가 없습니다.", status=400 ,json_dumps_params={'ensure_ascii': False})
        
        # SocialApp 가져오기
        app = SocialApp.objects.get(provider='naver', sites=settings.SITE_ID)
        
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
        
        token_response = requests.post(token_url, data=token_data)
        
        if token_response.status_code != 200:
            return HttpResponse(f"토큰 교환 실패: {token_response.text}", status=400 ,json_dumps_params={'ensure_ascii': False})
        
        token_info = token_response.json()
        access_token = token_info.get('access_token')
        
        # Naver User Info API를 사용하여 사용자 정보 요청
        user_info_url = 'https://openapi.naver.com/v1/nid/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(user_info_url, headers=headers)
        
        if user_response.status_code != 200:
            return HttpResponse(f"사용자 정보 요청 실패: {user_response.text}", status=400 ,json_dumps_params={'ensure_ascii': False})
        
        user_info = user_response.json()
        
        # 사용자 생성 또는 로그인
        from django.contrib.auth.models import User
        from allauth.socialaccount.models import SocialAccount
        
        # 네이버 계정 정보에서 이메일 추출
        response = user_info.get('response', {})
        email = response.get('email')
        
        # 이메일이 없는 경우 네이버 ID로 임시 이메일 생성
        if not email:
            naver_id = response.get('id')
            email = f"naver_{naver_id}@naver.temp"
        
        # 이메일로 기존 사용자 찾기
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': f"naver_{response.get('id')}",
                'first_name': response.get('name', ''),
            }
        )
        
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
        
        # 팝업창 닫기 페이지로 리디렉션
        return render(request, 'socialaccount/popup_close.html')
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return HttpResponse(f"OAuth callback 처리 오류: {str(e)}", status=500 ,json_dumps_params={'ensure_ascii': False})

def github_login_redirect(request):
    """GitHub OAuth 직접 리디렉션 (allauth 중간창 우회)"""
    try:
        app = SocialApp.objects.get(provider='github', sites=settings.SITE_ID)
        # 직접 callback URL 사용
        callback_url = f'{settings.BASE_URL}/oauth/github/callback/'
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'scope': 'user:email',
            'prompt': 'consent',  # 계정 선택 창 강제 표시
        }
        url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
        return redirect(url)
    except SocialApp.DoesNotExist:
        return HttpResponse("Github OAuth 설정이 필요합니다. Django Admin에서 SocialApp을 확인해주세요.", status=500)
    except Exception as e:
        return HttpResponse(f"OAuth 리디렉션 오류: {str(e)}", status=500 ,json_dumps_params={'ensure_ascii': False})

def github_login_callback(request):
    """GitHub OAuth callback 직접 처리 (로그인 전용)"""
    try:
        code = request.GET.get('code')
        
        if not code:
            return HttpResponse("인증 코드가 없습니다.", status=400 ,json_dumps_params={'ensure_ascii': False})
        
        # SocialApp 가져오기
        app = SocialApp.objects.get(provider='github', sites=settings.SITE_ID)
        
        # GitHub OAuth2 API를 직접 호출하여 토큰 교환
        import requests
        
        token_url = 'https://github.com/login/oauth/access_token'
        token_data = {
            'client_id': app.client_id,
            'client_secret': app.secret,
            'code': code,
        }
        headers = {'Accept': 'application/json'}
        
        token_response = requests.post(token_url, data=token_data, headers=headers)
        
        if token_response.status_code != 200:
            return HttpResponse(f"토큰 교환 실패: {token_response.text}", status=400 ,json_dumps_params={'ensure_ascii': False})
        
        token_info = token_response.json()
        access_token = token_info.get('access_token')
        
        # GitHub User Info API를 사용하여 사용자 정보 요청
        user_info_url = 'https://api.github.com/user'
        headers = {
            'Authorization': f'token {access_token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        user_response = requests.get(user_info_url, headers=headers)
        
        if user_response.status_code != 200:
            return HttpResponse(f"사용자 정보 요청 실패: {user_response.text}", status=400 ,json_dumps_params={'ensure_ascii': False})
        
        user_info = user_response.json()
        
        # GitHub User Email API를 사용하여 이메일 정보 요청
        email_url = 'https://api.github.com/user/emails'
        email_response = requests.get(email_url, headers=headers)
        
        if email_response.status_code != 200:
            return HttpResponse(f"이메일 정보 요청 실패: {email_response.text}", status=400 ,json_dumps_params={'ensure_ascii': False})
        
        emails = email_response.json()
        
        # 기본 이메일 찾기
        primary_email = None
        for email_info in emails:
            if email_info.get('primary') and email_info.get('verified'):
                primary_email = email_info.get('email')
                break
        
        # 기본 이메일이 없는 경우 GitHub username으로 임시 이메일 생성
        if not primary_email:
            github_username = user_info.get('login')
            primary_email = f"{github_username}@github.temp"
        
        # 로그인 모드: 사용자 생성 또는 로그인
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
        
        # 팝업창 닫기 페이지로 리디렉션
        return render(request, 'socialaccount/popup_close.html')
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return HttpResponse(f"OAuth callback 처리 오류: {str(e)}", status=500 ,json_dumps_params={'ensure_ascii': False})

def google_login_callback(request):
    """Google OAuth callback 직접 처리"""
    try:
        code = request.GET.get('code')
        if not code:
            return HttpResponse("인증 코드가 없습니다.", status=400)
        
        # SocialApp 가져오기
        app = SocialApp.objects.get(provider='google', sites=settings.SITE_ID)
        
        # Google OAuth2 API를 직접 호출하여 토큰 교환
        import requests
        
        token_url = 'https://oauth2.googleapis.com/token'
        token_data = {
            'client_id': app.client_id,
            'client_secret': app.secret,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': f'{settings.BASE_URL}/oauth/google/callback/'
        }
        
        token_response = requests.post(token_url, data=token_data)
        
        if token_response.status_code != 200:
            return HttpResponse(f"토큰 교환 실패: {token_response.text}", status=400)
        
        token_info = token_response.json()
        access_token = token_info.get('access_token')
        
        # Google User Info API를 사용하여 사용자 정보 요청
        user_info_url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_response = requests.get(user_info_url, headers=headers)
        
        if user_response.status_code != 200:
            return HttpResponse(f"사용자 정보 요청 실패: {user_response.text}", status=400)
        
        user_info = user_response.json()
        
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
        
        # 팝업창 닫기 페이지로 리디렉션
        return render(request, 'socialaccount/popup_close.html')
        
    except Exception as e:
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
        callback_url = f'{settings.BASE_URL}/oauth/google/connect/callback/'
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            'scope': 'openid profile email',
            'access_type': 'online',
            'state': 'connect',  # 연결 모드임을 나타내는 state
            'prompt': 'select_account',  # 계정 선택 창 강제 표시
        }
        url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        return redirect(url)
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'Google OAuth 앱이 설정되지 않았습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
    except Exception as e:
        return JsonResponse({'error': 'OAuth 리디렉션 중 오류가 발생했습니다.'}, status=500 ,json_dumps_params={'ensure_ascii': False})

@login_required
def google_connect_callback(request):
    """Google OAuth 계정 연결 콜백 처리"""
    code = request.GET.get('code')
    state = request.GET.get('state')
    
    if not code:
        return JsonResponse({'error': '인증 코드가 없습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
    
    try:
        app = SocialApp.objects.get(provider='google', sites=settings.SITE_ID)
        
        # 액세스 토큰 교환
        token_url = 'https://oauth2.googleapis.com/token'
        token_data = {
            'client_id': app.client_id,
            'client_secret': app.secret,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': f'{settings.BASE_URL}/oauth/google/connect/callback/',
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
                return JsonResponse({'error': '이 Google 계정은 이미 다른 사용자에게 연결되어 있습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
        
        # 토큰 저장
        if created:
            # expires_in을 정수로 변환
            expires_in = int(token_info.get('expires_in', 3600))
            SocialToken.objects.create(
                account=social_account,
                token=access_token,
                expires_at=timezone.now() + timezone.timedelta(seconds=expires_in)
            )
        
        return render(request, 'socialaccount/popup_close.html')
        
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'Google OAuth 앱이 설정되지 않았습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
    except requests.RequestException as e:
        return JsonResponse({'error': 'OAuth API 요청 중 오류가 발생했습니다.'}, status=500 ,json_dumps_params={'ensure_ascii': False})
    except Exception as e:
        return JsonResponse({'error': 'OAuth 콜백 처리 중 오류가 발생했습니다.'}, status=500 ,json_dumps_params={'ensure_ascii': False})

@login_required
def kakao_connect_redirect(request):
    """Kakao OAuth 계정 연결 리디렉션"""
    try:
        app = SocialApp.objects.get(provider='kakao', sites=settings.SITE_ID)
        callback_url = f'{settings.BASE_URL}/oauth/kakao/connect/callback/'
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            'scope': 'profile_nickname profile_image',
            'force_login': 'true',  # 계정 선택 창 강제 표시
        }
        url = f"https://kauth.kakao.com/oauth/authorize?{urlencode(params)}"
        return redirect(url)
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'Kakao OAuth 앱이 설정되지 않았습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
    except Exception as e:
        return JsonResponse({'error': 'OAuth 리디렉션 중 오류가 발생했습니다.'}, status=500 ,json_dumps_params={'ensure_ascii': False})

@login_required
def kakao_connect_callback(request):
    """Kakao OAuth 계정 연결 콜백 처리"""
    code = request.GET.get('code')
    if not code:
        return JsonResponse({'error': '인증 코드가 없습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
    
    try:
        app = SocialApp.objects.get(provider='kakao', sites=settings.SITE_ID)
        
        # 액세스 토큰 교환
        token_url = 'https://kauth.kakao.com/oauth/token'
        token_data = {
            'grant_type': 'authorization_code',
            'client_id': app.client_id,
            'client_secret': app.secret,
            'code': code,
            'redirect_uri': f'{settings.BASE_URL}/oauth/kakao/connect/callback/',
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
        kakao_uid = str(user_info['id'])

        # ⚠️ 먼저 이미 다른 유저와 연결되어 있는지 확인
        existing_account = SocialAccount.objects.filter(provider='kakao', uid=kakao_uid).first()
        if existing_account and existing_account.user != request.user:
            return JsonResponse({'error': '이 Kakao 계정은 이미 다른 사용자에게 연결되어 있습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})

        # 소셜 계정 연결 (없으면 생성)
        social_account, created = SocialAccount.objects.get_or_create(
            provider='kakao',
            uid=kakao_uid,
            defaults={'user': request.user}
        )

        # 토큰 저장 또는 갱신
        expires_in = int(token_info.get('expires_in', 21600))
        if created:
            SocialToken.objects.create(
                account=social_account,
                token=access_token,
                expires_at=timezone.now() + timezone.timedelta(seconds=expires_in)
            )
        else:
            # 이미 존재할 경우 토큰 갱신
            token_obj = SocialToken.objects.filter(account=social_account).first()
            if token_obj:
                token_obj.token = access_token
                token_obj.expires_at = timezone.now() + timezone.timedelta(seconds=expires_in)
                token_obj.save()

        return render(request, 'socialaccount/popup_close.html')

    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'Kakao OAuth 앱이 설정되지 않았습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
    except requests.RequestException as e:
        return JsonResponse({'error': 'OAuth API 요청 중 오류가 발생했습니다.'}, status=500 ,json_dumps_params={'ensure_ascii': False})
    except Exception as e:
        return JsonResponse({'error': 'OAuth 콜백 처리 중 오류가 발생했습니다.'}, status=500 ,json_dumps_params={'ensure_ascii': False})

@login_required
def naver_connect_redirect(request):
    """Naver OAuth 계정 연결 리디렉션"""
    try:
        app = SocialApp.objects.get(provider='naver', sites=settings.SITE_ID)
        callback_url = f'{settings.BASE_URL}/oauth/naver/connect/callback/'
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            'state': 'naver_connect_state',
            'scope': 'name email',
            'auth_type': 'reauthenticate',  # 계정 선택 창 강제 표시
        }
        url = f"https://nid.naver.com/oauth2.0/authorize?{urlencode(params)}"
        return redirect(url)
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'Naver OAuth 앱이 설정되지 않았습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
    except Exception as e:
        return JsonResponse({'error': 'OAuth 리디렉션 중 오류가 발생했습니다.'}, status=500 ,json_dumps_params={'ensure_ascii': False})

@login_required
def naver_connect_callback(request):
    """Naver OAuth 계정 연결 콜백 처리"""
    code = request.GET.get('code')
    state = request.GET.get('state')
    
    if not code:
        return JsonResponse({'error': '인증 코드가 없습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
    
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
                return JsonResponse({'error': '이 Naver 계정은 이미 다른 사용자에게 연결되어 있습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
        
        # 토큰 저장
        if created:
            # expires_in을 정수로 변환
            expires_in = int(token_info.get('expires_in', 3600))
            SocialToken.objects.create(
                account=social_account,
                token=access_token,
                expires_at=timezone.now() + timezone.timedelta(seconds=expires_in)
            )
        
        return render(request, 'socialaccount/popup_close.html')
        
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'Naver OAuth 앱이 설정되지 않았습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
    except requests.RequestException as e:
        return JsonResponse({'error': 'OAuth API 요청 중 오류가 발생했습니다.'}, status=500 ,json_dumps_params={'ensure_ascii': False})
    except Exception as e:
        return JsonResponse({'error': 'OAuth 콜백 처리 중 오류가 발생했습니다.'}, status=500 ,json_dumps_params={'ensure_ascii': False})

@login_required
def github_connect_redirect(request):
    """GitHub OAuth 계정 연결 리디렉션"""
    try:
        app = SocialApp.objects.get(provider='github', sites=settings.SITE_ID)
        # 연결 전용 callback URL 사용
        callback_url = f'{settings.BASE_URL}/oauth/github/connect/callback/'
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            'scope': 'read:user user:email',
            'prompt': 'consent',  # 계정 선택 창 강제 표시
        }
        url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
        return redirect(url)
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'GitHub OAuth 앱이 설정되지 않았습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
    except Exception as e:
        return JsonResponse({'error': 'OAuth 리디렉션 중 오류가 발생했습니다.'}, status=500 ,json_dumps_params={'ensure_ascii': False})

@login_required
def github_connect_callback(request):
    """GitHub OAuth 계정 연결 콜백 처리"""
    code = request.GET.get('code')
    
    if not code:
        return JsonResponse({'error': '인증 코드가 없습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
    
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
        
        token_response = requests.post(token_url, data=token_data, headers=headers)
        
        if token_response.status_code != 200:
            return HttpResponse(f"토큰 교환 실패: {token_response.text}", status=400 ,json_dumps_params={'ensure_ascii': False})
        
        token_info = token_response.json()
        access_token = token_info.get('access_token')
        
        # GitHub User Info API를 사용하여 사용자 정보 요청
        user_info_url = 'https://api.github.com/user'
        headers = {
            'Authorization': f'token {access_token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        user_response = requests.get(user_info_url, headers=headers)
        
        if user_response.status_code != 200:
            return HttpResponse(f"사용자 정보 요청 실패: {user_response.text}", status=400 ,json_dumps_params={'ensure_ascii': False})
        
        user_info = user_response.json()
        
        # 기존 사용자에게 소셜 계정 연결
        social_account, created = SocialAccount.objects.get_or_create(
            provider='github',
            uid=str(user_info.get('id')),
            defaults={'user': request.user}
        )
        
        if not created:
            # 이미 다른 사용자에게 연결된 경우
            if social_account.user != request.user:
                return JsonResponse({'error': '이 GitHub 계정은 이미 다른 사용자에게 연결되어 있습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
        
        # 토큰 저장
        if created:
            SocialToken.objects.create(
                account=social_account,
                token=access_token,
                expires_at=None  # GitHub 토큰은 만료되지 않음
            )
        
        return render(request, 'socialaccount/popup_close.html')
        
    except SocialApp.DoesNotExist:
        return JsonResponse({'error': 'GitHub OAuth 앱이 설정되지 않았습니다.'}, status=400 ,json_dumps_params={'ensure_ascii': False})
    except requests.RequestException as e:
        return JsonResponse({'error': 'OAuth API 요청 중 오류가 발생했습니다.'}, status=500 ,json_dumps_params={'ensure_ascii': False})
    except Exception as e:
        return JsonResponse({'error': 'OAuth 콜백 처리 중 오류가 발생했습니다.'}, status=500 ,json_dumps_params={'ensure_ascii': False})


