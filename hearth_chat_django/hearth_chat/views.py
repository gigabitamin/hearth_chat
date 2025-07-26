from django.views.generic import View
from django.http import HttpResponse
import os
from django.shortcuts import redirect
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
        adapter = GoogleOAuth2Adapter(request)
        callback_url = adapter.get_callback_url(request, app)
        print('[DEBUG][GOOGLE] callback_url:', callback_url)
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            'scope': 'openid email profile',
            'access_type': 'online',
        }
        print('[DEBUG][GOOGLE] auth_params:', params)
        url = f"{adapter.authorize_url}?{urlencode(params)}"
        print('[DEBUG][GOOGLE] redirect_url:', url)
        return redirect(url)
    except SocialApp.DoesNotExist:
        print('[DEBUG][GOOGLE] SocialApp DoesNotExist')
        return HttpResponse("Google OAuth 설정이 필요합니다. Django Admin에서 SocialApp을 확인해주세요.", status=500)
    except Exception as e:
        print('[DEBUG][GOOGLE] Exception:', e)
        return HttpResponse(f"OAuth 리디렉션 오류: {str(e)}", status=500)

def kakao_login_redirect(request):
    try:
        app = SocialApp.objects.get(provider='kakao', sites=settings.SITE_ID)
        adapter = KakaoOAuth2Adapter(request)
        callback_url = adapter.get_callback_url(request, app)
        print('[DEBUG][KAKAO] callback_url:', callback_url)
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
        }
        print('[DEBUG][KAKAO] auth_params:', params)
        url = f"{adapter.authorize_url}?{urlencode(params)}"
        print('[DEBUG][KAKAO] redirect_url:', url)
        return redirect(url)
    except SocialApp.DoesNotExist:
        print('[DEBUG][KAKAO] SocialApp DoesNotExist')
        return HttpResponse("Kakao OAuth 설정이 필요합니다. Django Admin에서 SocialApp을 확인해주세요.", status=500)
    except Exception as e:
        print('[DEBUG][KAKAO] Exception:', e)
        return HttpResponse(f"OAuth 리디렉션 오류: {str(e)}", status=500)

def naver_login_redirect(request):
    try:
        app = SocialApp.objects.get(provider='naver', sites=settings.SITE_ID)
        adapter = NaverOAuth2Adapter(request)
        callback_url = adapter.get_callback_url(request, app)
        print('[DEBUG][NAVER] callback_url:', callback_url)
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'response_type': 'code',
            'state': 'naver_state',  # 실제로는 CSRF 방지용 랜덤값 추천
        }
        print('[DEBUG][NAVER] auth_params:', params)
        url = f"{adapter.authorize_url}?{urlencode(params)}"
        print('[DEBUG][NAVER] redirect_url:', url)
        return redirect(url)
    except SocialApp.DoesNotExist:
        print('[DEBUG][NAVER] SocialApp DoesNotExist')
        return HttpResponse("Naver OAuth 설정이 필요합니다. Django Admin에서 SocialApp을 확인해주세요.", status=500)
    except Exception as e:
        print('[DEBUG][NAVER] Exception:', e)
        return HttpResponse(f"OAuth 리디렉션 오류: {str(e)}", status=500)

def github_login_redirect(request):
    try:
        app = SocialApp.objects.get(provider='github', sites=settings.SITE_ID)
        adapter = GitHubOAuth2Adapter(request)
        callback_url = adapter.get_callback_url(request, app)
        print('[DEBUG][GITHUB] callback_url:', callback_url)
        params = {
            'client_id': app.client_id,
            'redirect_uri': callback_url,
            'scope': 'user:email',
        }
        print('[DEBUG][GITHUB] auth_params:', params)
        url = f"{adapter.authorize_url}?{urlencode(params)}"
        print('[DEBUG][GITHUB] redirect_url:', url)
        return redirect(url)
    except SocialApp.DoesNotExist:
        print('[DEBUG][GITHUB] SocialApp DoesNotExist')
        return HttpResponse("Github OAuth 설정이 필요합니다. Django Admin에서 SocialApp을 확인해주세요.", status=500)
    except Exception as e:
        print('[DEBUG][GITHUB] Exception:', e)
        return HttpResponse(f"OAuth 리디렉션 오류: {str(e)}", status=500)

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
