from rest_framework.routers import DefaultRouter
from .admin_views import (
    AdminUserViewSet, 
    AdminRoomViewSet, 
    AdminMessageViewSet, 
    AdminStatsView,
    AdminBulkActionView,
    AdminMediaUploadView,
    AdminMediaListView,
)
from django.urls import path

# 관리자용 라우터
router = DefaultRouter()
router.register(r'users', AdminUserViewSet, basename='admin-user')
router.register(r'rooms', AdminRoomViewSet, basename='admin-room')
router.register(r'messages', AdminMessageViewSet, basename='admin-message')

# 관리자용 URL 패턴
urlpatterns = [
    path('stats/', AdminStatsView.as_view(), name='admin-stats'),
    path('bulk-action/', AdminBulkActionView.as_view(), name='admin-bulk-action'),
    path('upload_media/', AdminMediaUploadView.as_view(), name='admin-upload-media'),
    path('list_media_files/', AdminMediaListView.as_view(), name='admin-list-media-files'),
]

# 라우터 URL 추가
urlpatterns += router.urls 