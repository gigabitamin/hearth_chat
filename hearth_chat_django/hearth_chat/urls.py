"""
URL configuration for hearth_chat project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse
from .views import ReactAppView, social_connections_api
from django.views.static import serve as static_serve
import os


def home_redirect(request):
    """루트 URL을 admin으로 리다이렉트"""
    return redirect('admin:index')


def health_check(request):
    """Railway 헬스체크용 엔드포인트"""
    return HttpResponse("OK", content_type="text/plain")


def root_response(request):
    return HttpResponse("OK", content_type="text/plain")


def favicon(request):
    return HttpResponse("", content_type="image/x-icon")


def manifest_json(request):
    # Railway 환경에서는 build 폴더 경로가 다름
    if settings.DEBUG:
        manifest_path = os.path.join(settings.BASE_DIR, '..', 'hearth_chat_react', 'build', 'manifest.json')
    else:
        manifest_path = '/app/hearth_chat_react/build/manifest.json'
    return static_serve(request, os.path.basename(manifest_path), os.path.dirname(manifest_path))


def logo192_png(request):
    """logo192.png 파일 직접 서빙"""
    if settings.DEBUG:
        logo_path = os.path.join(settings.BASE_DIR, '..', 'hearth_chat_react', 'build', 'logo192.png')
    else:
        logo_path = '/app/hearth_chat_react/build/logo192.png'
    return static_serve(request, 'logo192.png', os.path.dirname(logo_path))


def robots_txt(request):
    """robots.txt 파일 직접 서빙"""
    if settings.DEBUG:
        robots_path = os.path.join(settings.BASE_DIR, '..', 'hearth_chat_react', 'build', 'robots.txt')
    else:
        robots_path = '/app/hearth_chat_react/build/robots.txt'
    return static_serve(request, 'robots.txt', os.path.dirname(robots_path))


def ignore_source_maps(request):
    """소스맵 파일 요청을 무시하고 빈 응답 반환"""
    return HttpResponse("", content_type="application/json")


urlpatterns = [
    path("favicon.ico", favicon),
    path("admin/", admin.site.urls),
    path('accounts/', include('allauth.urls')),  # allauth 소셜 로그인 URL
    path('chat/', include("chat.urls")),
    path('health/', health_check, name="health_check"),  # 헬스체크 엔드포인트
    path("manifest.json", manifest_json),  # manifest.json 직접 반환
    path("logo192.png", logo192_png),  # logo192.png 직접 반환
    path("robots.txt", robots_txt),  # robots.txt 직접 반환
    # 소스맵 파일들 무시
    path("static/js/", lambda r: ignore_source_maps(r)),  # .map 파일들
    path("static/css/", lambda r: ignore_source_maps(r)),  # .map 파일들
    path("api/social-connections/", social_connections_api, name="social_connections_api"),
    path("", ReactAppView.as_view(), name="root"),  # 루트에 React index.html 연결
]

# 운영 환경에서도 static 파일 서빙
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
# /avatar_vrm/ 경로를 staticfiles/avatar_vrm/로 매핑
urlpatterns += static('/avatar_vrm/', document_root=settings.STATIC_ROOT + '/avatar_vrm')
# /logo192.png 등 루트 파일도 직접 매핑
urlpatterns += static('/logo192.png', document_root=settings.STATIC_ROOT)

# /oauth_logo/ 경로를 staticfiles/oauth_logo/로 매핑
urlpatterns += static('/oauth_logo/', document_root=settings.STATIC_ROOT + '/oauth_logo')

# 미디어 파일 서빙 (이미지 업로드 등)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
