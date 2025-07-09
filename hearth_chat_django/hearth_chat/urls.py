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


def home_redirect(request):
    """루트 URL을 admin으로 리다이렉트"""
    return redirect('admin:index')


def health_check(request):
    """Railway 헬스체크용 엔드포인트"""
    return HttpResponse("OK", content_type="text/plain")


def root_response(request):
    return HttpResponse("OK", content_type="text/plain")


def catch_all(request, path):
    """모든 경로에 대한 기본 응답 (Railway 헬스체크용)"""
    return HttpResponse("OK", content_type="text/plain")


def favicon(request):
    return HttpResponse("", content_type="image/x-icon")


urlpatterns = [
    path("favicon.ico", favicon),
    path("", root_response, name="root"),  # 헬스체크용 루트 응답
    path("admin/", admin.site.urls),
    path('chat/', include("chat.urls")),
    path('health/', health_check, name="health_check"),  # 헬스체크 엔드포인트
    path('<path:path>', catch_all, name="catch_all"),  # 모든 경로에 대한 기본 응답
]

# Static files (CSS, JavaScript, Images)
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # Production 환경에서도 static 파일 서빙 (Railway)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
