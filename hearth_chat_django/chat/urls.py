from rest_framework.routers import DefaultRouter
from .views import ChatRoomViewSet, ChatViewSet, UserSettingsView, UserDeleteView, user_info, chat_home, get_chat_history, get_all_sessions, upload_chat_image, logout_api, UserListView, MessageReactionViewSet, MessageReplyViewSet, PinnedMessageViewSet, UserChatCreateAPIView, NotificationReadViewSet, file_exists
from django.urls import path, include
from . import views  # 상대경로로 변경

router = DefaultRouter()
router.register(r'rooms', ChatRoomViewSet, basename='room')
router.register(r'messages', ChatViewSet, basename='message')
router.register(r'reactions', MessageReactionViewSet, basename='reaction')
router.register(r'replies', MessageReplyViewSet, basename='reply')
router.register(r'pins', PinnedMessageViewSet, basename='pin')
router.register(r'notifications', NotificationReadViewSet, basename='notificationread')

urlpatterns = [
    path('user/settings/', UserSettingsView.as_view(), name='user-settings'),
    path('user/delete/', UserDeleteView.as_view(), name='user-delete'),
    path('user/', user_info, name='user_info'),
    path('users/', UserListView.as_view(), name='user-list'),
    path('', views.chat_home, name='chat_home'),  # /chat/ 메인 페이지
    path('history/', views.get_chat_history, name='chat_history'),
    path('sessions/', views.get_all_sessions, name='all_sessions'),
    path('upload_image/', views.upload_chat_image, name='upload_chat_image'),
    path('user/', views.user_info, name='user_info'),
    path('logout/', views.logout_api, name='logout_api'),
    path('rooms/user_chat_alt/', UserChatCreateAPIView.as_view(), name='user_chat_api'),  # APIView 추가
    path('messages/<int:pk>/delete/', ChatViewSet.as_view({'delete': 'delete_message'}), name='delete_message'),  # 메시지 삭제 API
    path('file_exists/', views.file_exists, name='file_exists'),
    path('list_media_files/', views.list_media_files, name='list_media_files'),
]


urlpatterns += router.urls