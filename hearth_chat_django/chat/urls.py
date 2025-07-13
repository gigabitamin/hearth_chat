from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatRoomViewSet, ChatViewSet, UserSettingsView

router = DefaultRouter()
router.register(r'rooms', ChatRoomViewSet, basename='room')
router.register(r'messages', ChatViewSet, basename='message')

urlpatterns = [
    path('user/settings/', UserSettingsView.as_view(), name='user-settings'),
]
urlpatterns += router.urls