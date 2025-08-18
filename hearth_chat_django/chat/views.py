from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import Chat
import json
import os
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
from django.http import HttpResponseBadRequest
from django.http import HttpResponse
from django.contrib.auth import logout as django_logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth import get_user_model
from allauth.socialaccount.models import SocialAccount
from rest_framework import viewsets, generics, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ChatRoom, Chat, ChatRoomParticipant, UserSettings, MessageReaction, MessageReply, PinnedMessage, NotificationRead, MessageFavorite
from .serializers import ChatRoomSerializer, ChatSerializer, ChatRoomParticipantSerializer, UserSettingsSerializer, MessageReactionSerializer, MessageReplySerializer, PinnedMessageSerializer, NotificationReadSerializer, MessageFavoriteSerializer
from django.contrib.auth.models import User
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.permissions import AllowAny
from rest_framework.authentication import SessionAuthentication
from django.shortcuts import get_object_or_404
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json
from django.db import models
from django.core.cache import cache
from django.conf import settings
from .models import MessageFavorite
from .models import MediaFile


# Create your views here.

def chat_home(request):
    return HttpResponse("Chat 메인 페이지입니다.")

@csrf_exempt
@require_http_methods(["GET"])
def get_chat_history(request):
    """대화 내역 조회 API"""
    try:
        session_id = request.GET.get('session_id')
        limit = int(request.GET.get('limit', 50))
        
        messages = Chat.get_recent_messages(session_id, limit)
        
        chat_history = []
        for message in messages:
            chat_history.append({
                'id': message.id,
                'message_type': message.message_type,
                'content': message.content,
                'timestamp': message.timestamp.isoformat(),
                'session_id': message.session_id
            })
        
        return JsonResponse({
            'status': 'success',
            'data': chat_history,
            'count': len(chat_history)
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def get_all_sessions(request):
    """모든 세션 목록 조회"""
    try:
        sessions = Chat.objects.values('session_id').distinct()
        session_list = [session['session_id'] for session in sessions if session['session_id']]
        
        return JsonResponse({
            'status': 'success',
            'sessions': session_list,
            'count': len(session_list)
        })
        
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
MAX_FILE_SIZE_MB = 4

@csrf_exempt
@require_http_methods(["POST"])
def upload_chat_image(request):
    """채팅 이미지 업로드 API (확장자, 용량, MIME 타입 검사)"""
    file = request.FILES.get('file')
    session_id = request.POST.get('session_id', None)
    content = request.POST.get('content', '')  # 메시지 내용도 받음    
    if not file:        
        return JsonResponse({'status': 'error', 'message': '파일이 첨부되지 않았습니다.'}, status=400)

    # 확장자 검사
    ext = file.name.split('.')[-1].lower()    
    if ext not in ALLOWED_EXTENSIONS:        
        return JsonResponse({'status': 'error', 'message': f'허용되지 않는 확장자입니다: {ext}'}, status=400)

    # 용량 검사
    if file.size > MAX_FILE_SIZE_MB * 1024 * 1024:        
        return JsonResponse({'status': 'error', 'message': f'파일 용량은 {MAX_FILE_SIZE_MB}MB 이하만 허용됩니다.'}, status=400)

    # MIME 타입 검사
    if file.content_type not in ALLOWED_MIME_TYPES:        
        return JsonResponse({'status': 'error', 'message': f'허용되지 않는 MIME 타입입니다: {file.content_type}'}, status=400)

    # 파일 저장
    from django.core.files.storage import default_storage
    from django.core.files.base import ContentFile
    from django.conf import settings
    
    # 파일을 저장하고 URL 생성
    file_path = default_storage.save(f'image/chat_attach/{file.name}', ContentFile(file.read()))
    
    # 절대 URL 생성
    if hasattr(settings, 'MEDIA_URL') and settings.MEDIA_URL.startswith('http'):
        file_url = f"{settings.MEDIA_URL}{file_path}"
    else:
        # 로컬 개발 환경에서는 상대 경로를 절대 경로로 변환
        file_url = f"/media/{file_path}"
    
    # 메시지 저장 제거 - WebSocket을 통해 받은 메시지만 저장
    
    return JsonResponse({
        'status': 'success',
        'file_url': file_url
    })

@csrf_exempt
@require_http_methods(["POST"])
def upload_multiple_chat_images(request):
    """다중 채팅 이미지 업로드 API"""
    files = request.FILES.getlist('files')
    content = request.POST.get('content', '')
    
    if not files:
        return JsonResponse({'status': 'error', 'message': '파일이 첨부되지 않았습니다.'}, status=400)

    # 최대 파일 개수 제한
    MAX_FILES = 5
    if len(files) > MAX_FILES:
        return JsonResponse({'status': 'error', 'message': f'최대 {MAX_FILES}개의 파일만 업로드할 수 있습니다.'}, status=400)

    uploaded_files = []
    errors = []

    for i, file in enumerate(files):
        try:
            # 확장자 검사
            ext = file.name.split('.')[-1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                errors.append(f'파일 {i+1}: 허용되지 않는 확장자입니다: {ext}')
                continue

            # 용량 검사
            if file.size > MAX_FILE_SIZE_MB * 1024 * 1024:
                errors.append(f'파일 {i+1}: 파일 용량은 {MAX_FILE_SIZE_MB}MB 이하만 허용됩니다.')
                continue

            # MIME 타입 검사
            if file.content_type not in ALLOWED_MIME_TYPES:
                errors.append(f'파일 {i+1}: 허용되지 않는 MIME 타입입니다: {file.content_type}')
                continue

            # 파일 저장
            from django.core.files.storage import default_storage
            from django.core.files.base import ContentFile
            from django.conf import settings
            
            # 파일을 저장하고 URL 생성
            file_path = default_storage.save(f'image/chat_attach/{file.name}', ContentFile(file.read()))
            
            # 절대 URL 생성
            if hasattr(settings, 'MEDIA_URL') and settings.MEDIA_URL.startswith('http'):
                file_url = f"{settings.MEDIA_URL}{file_path}"
            else:
                # 로컬 개발 환경에서는 상대 경로를 절대 경로로 변환
                file_url = f"/media/{file_path}"
            
            uploaded_files.append({
                'original_name': file.name,
                'file_url': file_url,
                'size': file.size
            })

        except Exception as e:
            errors.append(f'파일 {i+1}: 업로드 중 오류가 발생했습니다. ({str(e)})')

    if errors:
        return JsonResponse({
            'status': 'partial_success' if uploaded_files else 'error',
            'uploaded_files': uploaded_files,
            'errors': errors
        }, status=400 if not uploaded_files else 200)
    else:
        return JsonResponse({
            'status': 'success',
            'uploaded_files': uploaded_files
        })

@csrf_exempt
@require_http_methods(["GET"])
def user_info(request):
    """현재 로그인된 사용자 정보 + 로그인 방법 반환 API"""
    if request.user.is_authenticated:
        # 소셜 계정 연결 여부 확인
        from allauth.socialaccount.models import SocialAccount
        social_accounts = list(SocialAccount.objects.filter(user=request.user).values_list('provider', flat=True))
        has_password = request.user.has_usable_password()
        is_social_only = bool(social_accounts) and not has_password
        return JsonResponse({
            'status': 'success',
            'user': {
                'id': request.user.id,  # id 필드 추가
                'username': request.user.username,
                'email': request.user.email,
                'email_verified': request.user.emailaddress_set.filter(verified=True).exists(),
                'is_superuser': request.user.is_superuser,
                'is_staff': request.user.is_staff,
                'social_accounts': social_accounts,
                'has_password': has_password,
                'is_social_only': is_social_only,
            }
        })
    else:
        return JsonResponse({'status': 'error', 'message': 'Not authenticated'}, status=401)

@csrf_exempt
@require_http_methods(["POST"])
def logout_api(request):
    """로그아웃 API"""
    try:
        # Django 로그아웃 실행
        django_logout(request)
        
        # 세션 완전 삭제
        if hasattr(request, 'session'):
            request.session.flush()
            request.session.delete()
        
        # 응답에서 세션 쿠키 삭제
        response = JsonResponse({'status': 'success', 'message': 'Logged out'})
        response.delete_cookie('sessionid')
        response.delete_cookie('csrftoken')
        
        return response
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

class ChatRoomViewSet(viewsets.ModelViewSet):
    queryset = ChatRoom.objects.all()
    serializer_class = ChatRoomSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # 인증되지 않은 사용자는 공개방만 볼 수 있음
        if user.is_authenticated:
            # 공개방은 모두, 비공개방은 참여자만
            return ChatRoom.objects.filter(
                models.Q(is_public=True) | models.Q(chatroomparticipant__user=user)
            ).distinct()
        else:
            # 인증되지 않은 사용자는 공개방만
            return ChatRoom.objects.filter(is_public=True)
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # 공개방은 누구나, 비공개방은 참여자만
        if not instance.is_public:
            if not request.user.is_authenticated:
                return Response({'error': '비공개 방입니다. 로그인이 필요합니다.'}, status=403)
            elif not instance.participants.filter(id=request.user.id).exists():
                return Response({'error': '비공개 방입니다.'}, status=403)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def public(self, request):
        """전체 공개방 목록"""
        queryset = ChatRoom.objects.filter(is_public=True).order_by('-created_at')
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def join(self, request, pk=None):
        """공개방 입장"""
        room = self.get_object()
        
        if not room.is_public:
            return Response({'error': '비공개 방입니다.'}, status=400)
        
        # 이미 참여 중인지 확인
        if ChatRoomParticipant.objects.filter(room=room, user=request.user).exists():
            return Response({'error': '이미 참여 중인 방입니다.'}, status=400)
        
        # 참여자로 추가
        ChatRoomParticipant.objects.create(room=room, user=request.user)
        
        return Response({'message': '방에 입장했습니다.'})

    def perform_create(self, serializer):
        """대화방 생성 시 WebSocket으로 실시간 알림"""
        # 공개/비공개 설정 처리
        is_public = serializer.validated_data.get('is_public', False)
        ai_response_enabled = serializer.validated_data.get('ai_response_enabled', False)
        room_type = serializer.validated_data.get('room_type', 'user')
        
        # 화상채팅 방인 경우 자동으로 설정
        is_video_call = (room_type == 'video_call')
        
        room = serializer.save(
            is_public=is_public, 
            ai_response_enabled=ai_response_enabled,
            is_video_call=is_video_call
        )
        
        # 대화방 생성자 자동 참여 (방장으로 설정)
        ChatRoomParticipant.objects.get_or_create(
            room=room, 
            user=self.request.user,
            defaults={'is_owner': True}
        )
        
        # WebSocket으로 대화방 목록 업데이트 알림
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                'chat_room_list',
                {
                    'type': 'room_list_update',
                    'message': {
                        'type': 'room_created',
                        'room_id': room.id,
                        'room_name': room.name,
                        'creator': self.request.user.username,
                        'is_public': room.is_public,
                        'room_type': room.room_type,
                        'is_video_call': room.is_video_call
                    }
                }
            )
        except Exception as e:
            print(f"WebSocket 알림 실패: {e}")
        
        return room

    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        room = self.get_object()
        participant, created = ChatRoomParticipant.objects.get_or_create(room=room, user=request.user)
        
        # WebSocket으로 참여 알림
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                'chat_room_list',
                {
                    'type': 'room_list_update',
                    'message': {
                        'type': 'user_joined',
                        'room_id': room.id,
                        'user': request.user.username
                    }
                }
            )
        except Exception as e:
            print(f"WebSocket 알림 실패: {e}")
        
        return Response({'joined': True, 'room_id': room.id})

    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        room = self.get_object()
        ChatRoomParticipant.objects.filter(room=room, user=request.user).delete()
        
        # WebSocket으로 나가기 알림
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                'chat_room_list',
                {
                    'type': 'room_list_update',
                    'message': {
                        'type': 'user_left',
                        'room_id': room.id,
                        'user': request.user.username
                    }
                }
            )
        except Exception as e:
            print(f"WebSocket 알림 실패: {e}")
        
        return Response({'left': True, 'room_id': room.id})

    def destroy(self, request, *args, **kwargs):
        """대화방 삭제 (방장 또는 관리자만 가능)"""
        room = self.get_object()
        
        # 방장 또는 관리자 권한 확인
        is_owner = ChatRoomParticipant.objects.filter(
            room=room, 
            user=request.user, 
            is_owner=True
        ).exists()
        is_admin = request.user.is_superuser or request.user.is_staff
        
        if not (is_owner or is_admin):
            return Response(
                {'error': '방장 또는 관리자만 대화방을 삭제할 수 있습니다.'}, 
                status=403
            )
        
        # 대화방 삭제 전 WebSocket 알림
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                'chat_room_list',
                {
                    'type': 'room_list_update',
                    'message': {
                        'type': 'room_deleted',
                        'room_id': room.id,
                        'room_name': room.name,
                        'deleted_by': request.user.username
                    }
                }
            )
        except Exception as e:
            print(f"WebSocket 알림 실패: {e}")
        
        # 대화방 삭제
        room.delete()
        return Response({'deleted': True, 'room_id': room.id})

    @action(detail=True, methods=['post'])
    def favorite(self, request, pk=None):
        room = self.get_object()
        user = request.user
        room.favorite_users.add(user)
        return Response({'favorited': True, 'room_id': room.id})

    @action(detail=True, methods=['delete'])
    def unfavorite(self, request, pk=None):
        room = self.get_object()
        user = request.user
        room.favorite_users.remove(user)
        return Response({'favorited': False, 'room_id': room.id})

    @action(detail=False, methods=['get'])
    def my_favorites(self, request):
        user = request.user
        if not user.is_authenticated:
            return Response({'error': '로그인이 필요합니다.'}, status=401)
        
        rooms = ChatRoom.objects.filter(favorite_users=user)
        page = self.paginate_queryset(rooms)
        if page is not None:
            serializer = self.get_serializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(rooms, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    # @csrf_exempt  # CSRF 테스트 용 코드
    def user_chat(self, request):
        """1:1 채팅방 생성/조회 API (상대 user_id)"""
        user1 = request.user
        user2_id = request.data.get('user_id')
        if not user2_id:
            return Response({'error': 'user_id is required'}, status=400)
        try:
            user2 = User.objects.get(id=user2_id)
        except User.DoesNotExist:
            return Response({'error': '상대 유저가 존재하지 않습니다.'}, status=404)
        # 기존 1:1 방이 있으면 반환
        room = ChatRoom.objects.filter(room_type='user', participants=user1).filter(participants=user2).first()
        if not room:
            room = ChatRoom.create_user_chat_room(user1, user2)
        serializer = self.get_serializer(room, context={'request': request})
        return Response(serializer.data)

# @method_decorator(csrf_exempt, name='dispatch')
class ChatViewSet(viewsets.ModelViewSet):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """액션별로 권한 설정"""
        if self.action == 'favorite':
            # favorite 액션은 권한 체크 없이 인증된 사용자만 접근 가능
            return [IsAuthenticated()]
        return super().get_permissions()
            
    @action(detail=False, methods=['get'], url_path='my_favorites')
    def my_favorites(self, request):
        """내 즐겨찾기 메시지 목록"""
        # 세션 디버그 정보 출력
        print("🔍 my_favorites API 호출 - 세션 정보:")
        print(f"  - 요청 사용자: {request.user}")
        print(f"  - 인증 상태: {request.user.is_authenticated}")
        print(f"  - 세션 키: {request.session.session_key}")
        print(f"  - 세션 데이터: {dict(request.session)}")
        print(f"  - 쿠키: {request.COOKIES}")
        print(f"  - 헤더: {dict(request.headers)}")
        
        user = request.user
        if not user.is_authenticated:
            print("❌ 사용자 인증 실패")
            return Response({'error': '로그인이 필요합니다.'}, status=401)
        
        print("✅ 사용자 인증 성공")
        
        favorites = MessageFavorite.objects.filter(user=user).select_related('message').order_by('-created_at')
        data = [
            {
                'id': fav.message.id,
                'content': fav.message.content,
                'timestamp': fav.message.timestamp,
                'room_id': fav.message.room_id,
                'room_name': fav.message.room.name,
                'sender': fav.message.username,
            }
            for fav in favorites
        ]
        
        return Response({'results': data})        
    
    @action(detail=True, methods=['post', 'delete'])
    def favorite(self, request, pk=None):
        """메시지 즐겨찾기 토글 - 권한 체크 우회"""
        try:
            # 직접 메시지 조회 (권한 체크 없음)
            from .models import Chat
            message = Chat.objects.get(id=pk)
        except Chat.DoesNotExist:
            return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)
        
        user = request.user
        
        if request.method == 'POST':
            # 즐겨찾기 등록
            MessageFavorite.objects.get_or_create(user=user, message=message)
            return Response({'status': 'favorited'}, status=status.HTTP_201_CREATED)

        elif request.method == 'DELETE':
            # 즐겨찾기 해제
            deleted, _ = MessageFavorite.objects.filter(user=user, message=message).delete()
            if deleted:
                return Response({'status': 'unfavorited'}, status=status.HTTP_200_OK)
            else:
                return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['delete'], url_path='unfavorite')
    def unfavorite(self, request, pk=None):
        """메시지 즐겨찾기 해제"""
        message = self.get_object()
        user = request.user
        MessageFavorite.objects.filter(user=user, message=message).delete()
        return Response({'favorited': False, 'message_id': message.id})

    @action(detail=True, methods=['delete'])
    def delete_message(self, request, pk=None):        
        """메시지 삭제 (본인만 가능)"""
        message = self.get_object()
        user = request.user
        
        # 본인이 작성한 메시지인지 확인
        if message.username != user.username and message.user_id != user.id:
            return Response({'error': '본인이 작성한 메시지만 삭제할 수 있습니다.'}, status=403)
        
        # 메시지 삭제
        message_id = message.id
        message.delete()
        
        return Response({'status': 'deleted', 'message_id': message_id})

    def get_queryset(self):
        if self.action == 'list':
            room_id = self.request.query_params.get('room')
            offset = int(self.request.query_params.get('offset', 0))
            limit = int(self.request.query_params.get('limit', 20))
            if room_id:
                return Chat.objects.filter(room_id=room_id).order_by('-timestamp')[offset:offset+limit]
            return Chat.objects.none()
        # detail action 등에서는 전체 쿼리셋 반환
        return Chat.objects.all()

    def perform_create(self, serializer):
        # sender 필드가 없으므로, username과 user_id만 설정
        serializer.save(
            username=self.request.user.username,
            user_id=self.request.user.id
        )
        
    @action(detail=False, methods=['get'])
    def offset(self, request):
        """messageId로 해당 메시지가 윈도우 중앙에 위치하도록 offset 계산"""
        room_id = request.query_params.get('room')
        message_id = request.query_params.get('messageId')
        window_size = int(request.query_params.get('page_size', 40))  # 슬라이딩 윈도우 크기

        if not room_id or not message_id:
            return Response({'error': 'room and messageId parameters are required'}, status=400)

        try:
            # 해당 메시지의 인덱스 계산 (오래된순 정렬 기준)
            target_message = Chat.objects.get(id=message_id)
            message_index = Chat.objects.filter(
                room_id=room_id,
                timestamp__lt=target_message.timestamp
            ).order_by('timestamp').count()  # 0-based index

            # print(f'[offset API] messageId: {message_id}, message_index: {message_index}, window_size: {window_size}')
            
            # offset 계산 (윈도우 중앙에 위치하도록)
            offset = max(0, message_index - window_size // 2)
            
            # print(f'[offset API] 계산된 offset: {offset} (message_index: {message_index} - window_size/2: {window_size//2})')

            return Response({
                'offset': offset,
                'message_index': message_index,
                'window_size': window_size
            })

        except Chat.DoesNotExist:
            return Response({'error': 'Message not found'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['get'])
    def messages(self, request):
        """특정 방의 메시지 목록 반환 (페이지네이션 + 캐싱)"""        
        room_id = request.query_params.get('room')
        offset = int(request.query_params.get('offset', 0))
        limit = int(request.query_params.get('limit', 20))

        if not room_id:
            return Response({'error': 'room parameter is required'}, status=400)

        cache_key = f"room_messages_{room_id}_{offset}_{limit}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        try:
            total_count = Chat.objects.filter(room_id=room_id).count()            
            messages = Chat.objects.filter(room_id=room_id)\
                .select_related('room', 'question_message')\
                .prefetch_related('reactions', 'reactions__user')\
                .order_by('timestamp')[offset:offset + limit]

            message_list = []
            for msg in messages:
                if msg.sender_type == 'user':
                    sender_label = msg.username or f"User({msg.user_id})"
                    is_mine = (request.user.username == msg.username) or (request.user.id == msg.user_id)
                elif msg.sender_type == 'ai':
                    sender_label = msg.ai_name or msg.ai_type or 'AI'
                    is_mine = False
                elif msg.sender_type == 'system':
                    sender_label = 'System'
                    is_mine = False
                else:
                    sender_label = msg.username or msg.ai_name or 'Unknown'
                    is_mine = False

                reactions_data = {}
                for reaction in msg.reactions.all():
                    emoji = reaction.emoji
                    if emoji not in reactions_data:
                        reactions_data[emoji] = {'count': 0, 'users': []}
                    reactions_data[emoji]['count'] += 1
                    reactions_data[emoji]['users'].append(reaction.user.username)

                reactions_list = [
                    {'emoji': emoji, 'count': data['count'], 'users': data['users']}
                    for emoji, data in reactions_data.items()
                ]

                # imageUrls 필드 처리
                image_urls = []
                if msg.imageUrls:
                    try:
                        import json
                        image_urls = json.loads(msg.imageUrls)
                    except (json.JSONDecodeError, TypeError):
                        image_urls = []

                message_data = {
                    'id': msg.id,
                    'type': 'send' if is_mine else 'recv',
                    'text': msg.content,
                    'date': msg.timestamp.isoformat(),
                    'sender': sender_label,
                    'sender_type': msg.sender_type,
                    'username': msg.username,
                    'user_id': msg.user_id,
                    'ai_name': msg.ai_name,
                    'emotion': getattr(msg, 'emotion', None),
                    'imageUrl': msg.attach_image if msg.attach_image else None,  # .url 제거
                    'imageUrls': image_urls,  # 다중 이미지 URL 배열 추가
                    'reactions': reactions_list,
                    'questioner_username': (msg.question_message.username if msg.sender_type == 'ai' and msg.question_message else None)
                }
                
                message_list.append(message_data)
                
            

            response_data = {
                'results': message_list,
                'count': total_count,
                'has_more': len(message_list) == limit
            }        
            
            cache.set(cache_key, response_data, 0) # 즉시 캐시 삭제            

            return Response(response_data)

        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """특정 방의 최근 메시지 10개를 반환 (시간 내림차순)"""
        room_id = request.query_params.get('room')
        if not room_id:
            return Response({'error': 'room parameter is required'}, status=400)

        # 캐싱을 원한다면 여기에 추가
        # cache_key = f"room_recent_messages_{room_id}"
        # cached_data = cache.get(cache_key)
        # if cached_data:
        #     return Response(cached_data)

        try:
            # order_by('-timestamp')로 최신 메시지부터 정렬하고, limit(10)으로 10개만 가져옴옴
            messages = Chat.objects.filter(room_id=room_id)\
                .select_related('room', 'question_message')\
                .prefetch_related('reactions', 'reactions__user')\
                .order_by('-timestamp')[:10] # 최신순으로 10개만 가져오기

            # messages 함수 내부의 직렬화 로직을 재사용            
            message_list = []
            for msg in messages:
                if msg.sender_type == 'user':
                    sender_label = msg.username or f"User({msg.user_id})"
                    is_mine = (request.user.username == msg.username) or (request.user.id == msg.user_id)
                elif msg.sender_type == 'ai':
                    sender_label = msg.ai_name or msg.ai_type or 'AI'
                    is_mine = False
                else:
                    sender_label = 'System'
                    is_mine = False

                # ... (기존 messages 함수의 reactions, message_data 생성 로직과 동일) ...
                reactions_data = {}
                for reaction in msg.reactions.all():
                    emoji = reaction.emoji
                    if emoji not in reactions_data:
                        reactions_data[emoji] = {'count': 0, 'users': []}
                    reactions_data[emoji]['count'] += 1
                    reactions_data[emoji]['users'].append(reaction.user.username)

                reactions_list = [
                    {'emoji': emoji, 'count': data['count'], 'users': data['users']}
                    for emoji, data in reactions_data.items()
                ]

                message_data = {
                    'id': msg.id,
                    'type': 'send' if is_mine else 'recv',
                    'text': msg.content,
                    'date': msg.timestamp.isoformat(),
                    'sender': sender_label,
                    'sender_type': msg.sender_type,
                    'username': msg.username,
                    'user_id': msg.user_id,
                    'ai_name': msg.ai_name,
                    'emotion': getattr(msg, 'emotion', None),
                    'imageUrl': msg.attach_image if msg.attach_image else None,
                    'reactions': reactions_list,
                    'questioner_username': (msg.question_message.username if msg.sender_type == 'ai' and msg.question_message else None)
                }
                message_list.append(message_data)

            # cache.set(cache_key, message_list, 60) # 필요시 캐싱
            return Response({'results': message_list})

        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['get'])
    def all(self, request):
        """모든 메시지 반환 API (최대 1000개)"""
        try:
            messages = Chat.objects.all().select_related('room').order_by('-timestamp')[:1000]
            results = []
            for msg in messages:
                results.append({
                    'id': msg.id,
                    'content': msg.content,
                    'timestamp': msg.timestamp,
                    'sender': msg.username,
                    'room_id': msg.room_id,
                    'room_name': msg.room.name if msg.room else '',
                })
            return Response({'results': results})
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    # @action(detail=False, methods=['get', 'post'])
    @action(detail=False, methods=['get', 'post'])
    def search(self, request):
        """메시지 검색 API (GET/POST 모두 지원)"""
        if request.method == 'POST':
            query = request.data.get('q') or ''
            scope = request.data.get('scope') or 'all'
            sort_by = request.data.get('sort') or 'relevance'
            limit = int(request.data.get('limit') or 50)
        else:
            query = request.query_params.get('q', '')
            scope = request.query_params.get('scope', 'all')
            sort_by = request.query_params.get('sort', 'relevance')
            limit = int(request.query_params.get('limit', 50))
        
        if not query:
            return Response({'error': '검색어가 필요합니다.'}, status=400)
        
        try:
            from django.db.models import Q
            
            # 검색 조건 구성
            search_conditions = Q()
            
            if scope in ['all', 'message']:
                search_conditions |= Q(content__icontains=query)
            
            if scope in ['all', 'room']:
                search_conditions |= Q(room__name__icontains=query)
            
            if scope in ['all', 'user']:
                search_conditions |= Q(username__icontains=query)
            
            # 쿼리 실행
            messages = Chat.objects.filter(search_conditions)\
                .select_related('room')\
                .prefetch_related('reactions', 'reactions__user')
            
            # 정렬
            if sort_by == 'date':
                messages = messages.order_by('-timestamp')
            else:
                # 정확도순 정렬 (간단한 구현)
                messages = messages.order_by('-timestamp')
            
            # 결과 제한
            messages = messages[:limit]
            
            # 결과 변환
            results = []
            for msg in messages:
                if msg.sender_type == 'user':
                    sender_label = msg.username or f"User({msg.user_id})"
                elif msg.sender_type == 'ai':
                    sender_label = msg.ai_name or msg.ai_type or 'AI'
                elif msg.sender_type == 'system':
                    sender_label = 'System'
                else:
                    sender_label = msg.username or msg.ai_name or 'Unknown'
                
                # 문맥 메시지(이전/다음 1개씩)
                context_prev = Chat.objects.filter(room_id=msg.room_id, timestamp__lt=msg.timestamp).order_by('-timestamp').first()
                context_next = Chat.objects.filter(room_id=msg.room_id, timestamp__gt=msg.timestamp).order_by('timestamp').first()
                context = []
                if context_prev:
                    context.append({
                        'id': context_prev.id,
                        'content': context_prev.content,
                        'timestamp': context_prev.timestamp,
                        'sender': context_prev.username,
                        'room_id': context_prev.room_id,
                        'room_name': context_prev.room.name if context_prev.room else '',
                    })
                if context_next:
                    context.append({
                        'id': context_next.id,
                        'content': context_next.content,
                        'timestamp': context_next.timestamp,
                        'sender': context_next.username,
                        'room_id': context_next.room_id,
                        'room_name': context_next.room.name if context_next.room else '',
                    })
                
                result_data = {
                    'id': msg.id,
                    'type': 'message',
                    'content': msg.content,
                    'timestamp': msg.timestamp,
                    'sender': sender_label,
                    'room_id': msg.room_id,
                    'room_name': msg.room.name if msg.room else '',
                    'sender_type': msg.sender_type,
                    'username': msg.username,
                    'ai_name': msg.ai_name,
                    'context': context,  # 추가: 앞뒤 문맥 메시지
                }
                results.append(result_data)
            
            return Response({
                'results': results,
                'count': len(results),
                'query': query,
                'scope': scope,
                'sort_by': sort_by
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def update(self, request, *args, **kwargs):
        room = self.get_object()        
        is_owner = ChatRoomParticipant.objects.filter(
            room=room,
            user_id=int(request.user.id),  # ← int로 강제 변환
            is_owner=True
        ).exists()        
        # 방장 권한 체크
        is_admin = request.user.is_superuser or request.user.is_staff
        if not (is_owner or is_admin):
            return Response({'error': '방장 또는 관리자만 방 설정을 변경할 수 있습니다.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        room = self.get_object()        
        is_owner = ChatRoomParticipant.objects.filter(
            room=room,
            user_id=int(request.user.id),  # ← int로 강제 변환
            is_owner=True
        ).exists()        
        # 방장 권한 체크
        is_owner = ChatRoomParticipant.objects.filter(room=room, user=request.user, is_owner=True).exists()
        is_admin = request.user.is_superuser or request.user.is_staff
        if not (is_owner or is_admin):
            return Response({'error': '방장 또는 관리자만 방 설정을 변경할 수 있습니다.'}, status=403)
        return super().partial_update(request, *args, **kwargs)

# @method_decorator(csrf_exempt, name='dispatch')
class UserSettingsView(APIView):    
    # authentication_classes = [CsrfExemptSessionAuthentication]    
    permission_classes = [IsAuthenticated]
    # permission_classes = [AllowAny]

    def get(self, request):
        """사용자 설정 조회"""
        try:
            settings, created = UserSettings.objects.get_or_create(user=request.user)
            serializer = UserSettingsSerializer(settings)
            
            # 사용자 정보도 함께 반환
            from allauth.socialaccount.models import SocialAccount
            social_accounts = list(SocialAccount.objects.filter(user=request.user).values_list('provider', flat=True))
            has_password = request.user.has_usable_password()
            is_social_only = bool(social_accounts) and not has_password
            
            return Response({
                'settings': serializer.data,
                'user': {
                    'id': request.user.id,
                    'username': request.user.username,
                    'email': request.user.email,
                    'email_verified': request.user.emailaddress_set.filter(verified=True).exists(),
                    'is_superuser': request.user.is_superuser,
                    'is_staff': request.user.is_staff,
                    'social_accounts': social_accounts,
                    'has_password': has_password,
                    'is_social_only': is_social_only,
                }
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def post(self, request):
        """사용자 설정 생성"""
        try:
            settings, created = UserSettings.objects.get_or_create(user=request.user)
            serializer = UserSettingsSerializer(settings, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response({'settings': serializer.data})
            return Response(serializer.errors, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def patch(self, request):
        """사용자 설정 부분 업데이트"""
        try:
            settings, created = UserSettings.objects.get_or_create(user=request.user)
            
            # 카메라 관련 설정을 JSON으로 처리
            data = request.data.copy()
            camera_related_fields = [
                'camera_enabled', 'face_tracking_enabled', 'tracking_sensitivity',
                'tracking_smoothness', 'auto_tracking_enabled', 'tracking_camera_index'
            ]
            
            # 기존 camera_settings 가져오기
            current_camera_settings = {}
            if settings.camera_settings:
                try:
                    current_camera_settings = json.loads(settings.camera_settings)
                except (json.JSONDecodeError, TypeError):
                    current_camera_settings = {}
            
            # 카메라 관련 필드들을 JSON으로 통합
            camera_settings_updated = False
            for field in camera_related_fields:
                if field in data:
                    # 필드명을 JSON 키로 변환
                    json_key = field
                    if field == 'camera_enabled':
                        json_key = 'enabled'
                    
                    current_camera_settings[json_key] = data[field]
                    camera_settings_updated = True
                    del data[field]  # 원본 데이터에서 제거
            
            # camera_settings JSON 업데이트
            if camera_settings_updated:
                data['camera_settings'] = json.dumps(current_camera_settings)
            
            serializer = UserSettingsSerializer(settings, data=data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response({'settings': serializer.data})
            return Response(serializer.errors, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class UserDeleteView(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request):
        """회원탈퇴 API"""
        try:
            user = request.user
            
            # 사용자 확인을 위한 추가 검증
            confirmation = request.data.get('confirmation')
            if not confirmation or confirmation != 'DELETE_ACCOUNT':
                return Response({
                    'error': '회원탈퇴 확인이 필요합니다. confirmation 필드에 "DELETE_ACCOUNT"를 입력해주세요.'
                }, status=400)
            
            # 사용자 관련 데이터 삭제
            # 1. 사용자 설정 삭제
            UserSettings.objects.filter(user=user).delete()
            
            # 2. 채팅방 참여자 정보 삭제
            ChatRoomParticipant.objects.filter(user=user).delete()
            
            # 3. 사용자가 작성한 채팅 메시지 삭제
            Chat.objects.filter(sender=user.username).delete()
            
            # 4. 사용자가 생성한 채팅방 삭제 (방장인 경우)
            ChatRoom.objects.filter(creator=user).delete()
            
            # 5. 소셜 계정 연결 삭제
            from allauth.socialaccount.models import SocialAccount
            SocialAccount.objects.filter(user=user).delete()
            
            # 6. 이메일 주소 삭제
            from allauth.account.models import EmailAddress
            EmailAddress.objects.filter(user=user).delete()
            
            # 7. 사용자 계정 삭제
            username = user.username  # 삭제 전에 username 저장
            user.delete()
            
            # 8. 로그아웃 처리
            django_logout(request)
            
            # 9. 세션 완전 삭제
            if hasattr(request, 'session'):
                request.session.flush()
                request.session.delete()
            
            # 10. 응답에서 세션 쿠키 삭제
            response = Response({
                'status': 'success',
                'message': f'사용자 {username}의 계정이 성공적으로 삭제되었습니다.'
            })
            response.delete_cookie('sessionid')
            response.delete_cookie('csrftoken')
            
            return response
            
        except Exception as e:
            return Response({
                'error': f'회원탈퇴 중 오류가 발생했습니다: {str(e)}'
            }, status=500)

class UserListView(APIView):
    def get(self, request):
        users = User.objects.all()
        data = [
            {
                'id': u.id,
                'username': u.username,
                'email': u.email,
            } for u in users
        ]
        return Response({'results': data})

class MessageReactionViewSet(viewsets.ModelViewSet):
    queryset = MessageReaction.objects.all()
    serializer_class = MessageReactionSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        """메시지 반응 토글 (추가/제거)"""
        message = get_object_or_404(Chat, pk=pk)
        emoji = request.data.get('emoji')
        user = request.user
        
        if not emoji:
            return Response({'error': '이모지가 필요합니다.'}, status=400)
        
        # 기존 반응 확인
        existing_reaction = MessageReaction.objects.filter(
            message=message, user=user, emoji=emoji
        ).first()
        
        if existing_reaction:
            # 기존 반응 제거
            existing_reaction.delete()
            return Response({'status': 'removed'})
        else:
            # 새 반응 추가
            MessageReaction.objects.create(
                message=message, user=user, emoji=emoji
            )
            return Response({'status': 'added'})

class MessageReplyViewSet(viewsets.ModelViewSet):
    queryset = MessageReply.objects.all()
    serializer_class = MessageReplySerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save()

class PinnedMessageViewSet(viewsets.ModelViewSet):
    queryset = PinnedMessage.objects.all()
    serializer_class = PinnedMessageSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(pinned_by=self.request.user)

    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        """메시지 고정 토글"""
        message = get_object_or_404(Chat, pk=pk)
        room = message.room
        user = request.user
        
        # 기존 고정 확인
        existing_pin = PinnedMessage.objects.filter(
            room=room, message=message
        ).first()
        
        if existing_pin:
            # 고정 해제
            existing_pin.delete()
            return Response({'status': 'unpinned'})
        else:
            # 고정
            PinnedMessage.objects.create(
                room=room, message=message, pinned_by=user
            )
            return Response({'status': 'pinned'})

    @action(detail=False, methods=['get'])
    def room_pins(self, request):
        """방의 고정된 메시지 목록"""
        room_id = request.query_params.get('room_id')
        if not room_id:
            return Response({'error': 'room_id가 필요합니다.'}, status=400)
        
        pins = PinnedMessage.objects.filter(room_id=room_id).order_by('-pinned_at')
        serializer = self.get_serializer(pins, many=True)
        return Response(serializer.data)
    
# 새로운 user view 등록 기존 ViewSet 구조는 그대로 둠
class UserChatCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):        
        user1 = request.user
        user2_id = request.data.get('user_id')

        if not user2_id:
            return Response({'error': 'user_id is required'}, status=400)

        try:
            user2 = User.objects.get(id=user2_id)
        except User.DoesNotExist:
            return Response({'error': '상대 유저가 존재하지 않습니다.'}, status=404)

        # 기존 방이 있는지 확인
        room = ChatRoom.objects.filter(room_type='user', participants=user1).filter(participants=user2).first()
        if not room:
            room = ChatRoom.create_user_chat_room(user1, user2)

        serializer = ChatRoomSerializer(room, context={'request': request})
        return Response(serializer.data)

class NotificationReadViewSet(viewsets.ModelViewSet):
    queryset = NotificationRead.objects.all()
    serializer_class = NotificationReadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # 본인만 조회
        return NotificationRead.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def unread(self, request):
        # 예시: 읽지 않은 알림(방/메시지) 목록 반환
        # 실제 구현은 프론트 요구에 맞게 조정 필요
        read_qs = NotificationRead.objects.filter(user=request.user)
        read_message_ids = read_qs.values_list('message_id', flat=True)
        # 예시: 즐겨찾기 방의 최신 메시지 중 읽지 않은 것만 반환
        from .models import ChatRoom, Chat
        favorite_rooms = ChatRoom.objects.filter(favorite_users=request.user)
        unread = []
        for room in favorite_rooms:
            latest = Chat.objects.filter(room=room).order_by('-timestamp').first()
            if latest and latest.id not in read_message_ids:
                unread.append({
                    'room_id': room.id,
                    'room_name': room.name,
                    'message_id': latest.id,
                    'message': latest.content,
                    'timestamp': latest.timestamp,
                })
        return Response(unread)

# 미디어/스태틱 경로 파일 존재 여부 확인 (로컬/서버)
from django.core.files.storage import default_storage
from django.http import JsonResponse

def file_exists(request):
    rel_path = request.GET.get("path", "").lstrip("/")
    abs_path_media = os.path.join(settings.MEDIA_ROOT, rel_path)
    abs_path_static = os.path.join(settings.STATIC_ROOT, rel_path)
    exists = os.path.exists(abs_path_media) or os.path.exists(abs_path_static)    
    return JsonResponse({ "exists": exists })

# 미디어 파일 목록 조회
def list_media_files(request):
    file_list = []
    for root, dirs, files in os.walk(settings.MEDIA_ROOT):
        for name in files:
            rel_path = os.path.relpath(os.path.join(root, name), settings.MEDIA_ROOT)            
            file_list.append(rel_path)    
    return JsonResponse({"files": file_list})


@csrf_exempt
@login_required
def toggle_message_favorite(request, pk):
    """메시지 즐겨찾기 토글 - 별도 뷰로 권한 문제 해결"""
    try:
        message = Chat.objects.get(id=pk)
        user = request.user
        
        if request.method == 'POST':
            # 즐겨찾기 등록
            MessageFavorite.objects.get_or_create(user=user, message=message)
            return JsonResponse({'status': 'favorited'}, status=201)
        elif request.method == 'DELETE':
            # 즐겨찾기 해제
            deleted, _ = MessageFavorite.objects.filter(user=user, message=message).delete()
            if deleted:
                return JsonResponse({'status': 'unfavorited'}, status=200)
            else:
                return JsonResponse({'error': 'Not found'}, status=404)
        else:
            return JsonResponse({'error': 'Method not allowed'}, status=405)
            
    except Chat.DoesNotExist:
        return JsonResponse({'error': 'Message not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
