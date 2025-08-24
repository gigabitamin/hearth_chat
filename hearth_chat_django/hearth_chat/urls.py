from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import render
from django.http import HttpResponse
from django.views.static import serve
import os

from .views import (
    social_connections_api, social_login_redirect_view, get_csrf_token, 
    google_login_redirect, google_login_callback, kakao_login_redirect, kakao_login_callback, 
    naver_login_redirect, naver_login_callback, github_login_redirect, github_login_callback,
    google_connect_redirect, google_connect_callback, kakao_connect_redirect, kakao_connect_callback,
    naver_connect_redirect, naver_connect_callback, github_connect_redirect, github_connect_callback,
    DebugLoginView, CustomSignupView, ReactAppView, api_login
)

urlpatterns = [
    # --- 1. 특정 파일 및 API 경로 정의 ---    
    path("admin/", admin.site.urls),
    path('api/chat/', include('chat.urls')),
    path('api/admin/', include('chat.admin_urls')),
    path('health/', lambda r: HttpResponse(b"OK", content_type="text/plain"), name="health_check"),
    path("api/social-connections/", social_connections_api, name="social_connections_api"),
    path("social-redirect/", social_login_redirect_view, name='social_login_redirect'),
    path("api/csrf/", get_csrf_token, name="get_csrf_token"),
    path("api/login/", api_login, name="api_login"),
    
    # 디버그 로그인 뷰 추가
    path('debug-login/', DebugLoginView.as_view(), name='debug_login'),
    
    # allauth 기본 로그인/회원가입 뷰를 커스텀 뷰로 완전 대체
    path('accounts/login/', DebugLoginView.as_view(), name='account_login'),
    path('accounts/signup/', CustomSignupView.as_view(), name='account_signup'),
    
    # allauth URL을 마지막에 배치 (커스텀 로그인 뷰가 우선)
    path('accounts/', include('allauth.urls')),
    
    # OAuth 관련 경로들
    path("oauth/google/", google_login_redirect, name="google_oauth_direct"),
    path("oauth/google/callback/", google_login_callback, name="google_oauth_callback"),
    path("oauth/kakao/", kakao_login_redirect, name="kakao_oauth_direct"),
    path("oauth/kakao/callback/", kakao_login_callback, name="kakao_oauth_callback"),
    path("oauth/naver/", naver_login_redirect, name="naver_oauth_direct"),
    path("oauth/naver/callback/", naver_login_callback, name="naver_oauth_callback"),
    path("oauth/github/", github_login_redirect, name="github_oauth_direct"),
    path("oauth/github/callback/", github_login_callback, name="github_oauth_callback"),
    path("oauth/google/connect/", google_connect_redirect, name="google_connect_direct"),
    path("oauth/google/connect/callback/", google_connect_callback, name="google_connect_callback"),
    path("oauth/kakao/connect/", kakao_connect_redirect, name="kakao_connect_direct"),
    path("oauth/kakao/connect/callback/", kakao_connect_callback, name="kakao_connect_callback"),
    path("oauth/naver/connect/", naver_connect_redirect, name="naver_connect_direct"),
    path("oauth/naver/connect/callback/", naver_connect_callback, name="naver_connect_callback"),
    path("oauth/github/connect/", github_connect_redirect, name="github_connect_direct"),
    path("oauth/github/connect/callback/", github_connect_callback, name="github_connect_callback"),
    path("accounts/popup-close/", lambda r: render(r, 'socialaccount/popup_close.html', {}), name="popup_close"),
]

# --- 2. 미디어 파일 서빙 설정 (개발 및 프로덕션 환경 모두) ---
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# 미디어 파일 경로 디버깅을 위한 로깅
print(f"🔍 URL 설정 - MEDIA_URL: {settings.MEDIA_URL}")
print(f"🔍 URL 설정 - MEDIA_ROOT: {settings.MEDIA_ROOT}")
print(f"🔍 URL 설정 - BASE_DIR: {settings.BASE_DIR}")

# 추가 미디어 파일 서빙 패턴 (프로덕션 환경에서 더 안정적인 서빙을 위해)
def media_serve(request, path):
    """커스텀 미디어 파일 서빙 뷰"""
    try:
        # 미디어 파일 경로 로깅
        print(f"🔍 미디어 파일 요청: {path}")
        print(f"🔍 MEDIA_ROOT: {settings.MEDIA_ROOT}")
        print(f"🔍 전체 경로: {os.path.join(settings.MEDIA_ROOT, path)}")
        
        # 파일 존재 여부 확인
        full_path = os.path.join(settings.MEDIA_ROOT, path)
        if os.path.exists(full_path):
            print(f"✅ 파일 존재: {full_path}")
        else:
            print(f"❌ 파일 없음: {full_path}")
            print(f"❌ MEDIA_ROOT 디렉토리 내용:")
            try:
                for root, dirs, files in os.walk(settings.MEDIA_ROOT):
                    print(f"   {root}: {len(files)} files")
            except Exception as e:
                print(f"   디렉토리 읽기 오류: {e}")
        
        return serve(request, path, document_root=settings.MEDIA_ROOT)
    except Exception as e:
        print(f"❌ 미디어 파일 서빙 오류: {e}")
        return HttpResponse(f"미디어 파일 서빙 오류: {e}", status=500)

# 미디어 파일을 위한 추가 URL 패턴
urlpatterns.append(re_path(r'^media/(?P<path>.*)$', media_serve, name='media_serve'))

# --- 3. 정적 파일 서빙 (프로덕션 환경에서도 필요) ---
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# --- 4. React 앱 서빙 (Fallback) - 정적 파일 경로 제외 ---
urlpatterns.append(re_path(r"^(?!admin|api|accounts|oauth|social-redirect|health|static|media|favicon\.ico|manifest\.json).*", ReactAppView.as_view()))

