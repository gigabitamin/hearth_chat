from django.contrib import admin
from django.urls import path, include, re_path
from django.shortcuts import redirect, render
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse

from .views import ReactAppView, social_connections_api, social_login_redirect_view, get_csrf_token
from django.views.static import serve as static_serve
import os
from django.views.generic import TemplateView

urlpatterns = [
    path("favicon.ico", lambda r: HttpResponse(b"", content_type="image/x-icon")),
    path("admin/", admin.site.urls),
    path('accounts/', include('allauth.urls')),
    path('api/chat/', include('chat.urls')),
    path('api/admin/', include('chat.admin_urls')),  # 관리자 API 추가
    path('health/', lambda r: HttpResponse(b"OK", content_type="text/plain"), name="health_check"),
    path("manifest.json", lambda r: static_serve(r, 'manifest.json', os.path.dirname(os.path.join(settings.BASE_DIR, '..', 'hearth_chat_react', 'build', 'manifest.json')))),
    path("logo192.png", lambda r: static_serve(r, 'logo192.png', os.path.dirname(os.path.join(settings.BASE_DIR, '..', 'hearth_chat_react', 'build', 'logo192.png')))),
    path("logo512.png", lambda r: static_serve(r, 'logo512.png', os.path.dirname(os.path.join(settings.BASE_DIR, '..', 'hearth_chat_react', 'build', 'logo512.png')))),
    path("robots.txt", lambda r: static_serve(r, 'robots.txt', os.path.dirname(os.path.join(settings.BASE_DIR, '..', 'hearth_chat_react', 'build', 'robots.txt')))),
    path("static/js/", lambda r: HttpResponse(b"", content_type="application/json")),
    path("static/css/", lambda r: HttpResponse(b"", content_type="application/json")),
    path("api/social-connections/", social_connections_api, name="social_connections_api"),
    path("social-redirect/", social_login_redirect_view, name='social_login_redirect'),
    path("api/csrf/", get_csrf_token, name="get_csrf_token"),
    path("accounts/popup-close/", lambda r: render(r, 'socialaccount/popup_close.html'), name="popup_close"),
    # path("gb_m_v2.vrm", lambda r: static_serve(r, 'gb_m_v2.vrm', os.path.dirname(os.path.join(settings.BASE_DIR, '..', 'hearth_chat_django', 'staticfiles', 'avatar_vrm', 'gb_m_v2.vrm')))),
    # path("gb_f_v2.vrm", lambda r: static_serve(r, 'gb_f_v2.vrm', os.path.dirname(os.path.join(settings.BASE_DIR, '..', 'hearth_chat_django', 'staticfiles', 'avatar_vrm', 'gb_f_v2.vrm')))),
    path("", ReactAppView.as_view(), name="root"),    
]

# static, media 등 추가 SPA fallback 전에 추가
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
urlpatterns += static('/avatar_vrm/', document_root=settings.STATIC_ROOT + '/avatar_vrm')    
# urlpatterns += static('/gb_m_v2.vrm', document_root=settings.STATIC_ROOT)
# urlpatterns += static('/gb_f_v2.vrm', document_root=settings.STATIC_ROOT)
urlpatterns += static('/logo192.png', document_root=settings.STATIC_ROOT)
urlpatterns += static('/oauth_logo/', document_root=settings.STATIC_ROOT + '/oauth_logo')

# SPA fallback
urlpatterns += [re_path(r"^(?!api/|admin/|static/|media/).*$", ReactAppView.as_view())]
urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', static_serve, {'document_root': settings.MEDIA_ROOT}),
]
