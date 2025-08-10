from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static
from django.shortcuts import render
from django.http import HttpResponse

from .views import (
    social_connections_api, social_login_redirect_view, get_csrf_token, 
    google_login_redirect, google_login_callback, kakao_login_redirect, kakao_login_callback, 
    naver_login_redirect, naver_login_callback, github_login_redirect, github_login_callback,
    google_connect_redirect, google_connect_callback, kakao_connect_redirect, kakao_connect_callback,
    naver_connect_redirect, naver_connect_callback, github_connect_redirect, github_connect_callback
)

urlpatterns = [
    # --- 1. 특정 파일 및 API 경로 정의 ---    
    path("admin/", admin.site.urls),
    path('accounts/', include('allauth.urls')),
    path('api/chat/', include('chat.urls')),
    path('api/admin/', include('chat.admin_urls')),
    path('health/', lambda r: HttpResponse(b"OK", content_type="text/plain"), name="health_check"),
    path("api/social-connections/", social_connections_api, name="social_connections_api"),
    path("social-redirect/", social_login_redirect_view, name='social_login_redirect'),
    path("api/csrf/", get_csrf_token, name="get_csrf_token"),
    
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

# --- 3. 정적 파일 서빙 (프로덕션 환경에서도 필요) ---
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# --- 4. React 앱 서빙 (Fallback) - 정적 파일 경로 제외 ---
urlpatterns.append(re_path(r"^(?!admin|api|accounts|oauth|social-redirect|health|static|media|favicon\.ico|manifest\.json).*", TemplateView.as_view(template_name="index.html")))

