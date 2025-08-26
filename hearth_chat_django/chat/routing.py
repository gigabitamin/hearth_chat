from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^ws/chat/$', consumers.ChatConsumer.as_asgi()),
    # 방 ID를 URL 경로로 전달하는 형태도 지원 (자동 그룹 조인)
    re_path(r'^ws/chat/(?P<room_id>\d+)/$', consumers.ChatConsumer.as_asgi()),
]