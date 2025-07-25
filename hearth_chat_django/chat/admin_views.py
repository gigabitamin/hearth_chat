from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser
from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta
from .models import ChatRoom, Chat, ChatRoomParticipant, MessageReaction, MessageReply, PinnedMessage
from .models import MediaFile
from .serializers import UserSerializer, ChatRoomSerializer, ChatSerializer
from .serializers import MediaFileSerializer
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.permissions import IsAdminUser
from rest_framework.permissions import AllowAny


class IsAdminOrReadOnly(permissions.BasePermission):
    """관리자만 접근 가능한 권한 클래스"""
    def has_permission(self, request, view):
        return request.user and request.user.is_staff


class AdminPagination(PageNumberPagination):
    """관리자 페이지네이션"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class AdminUserViewSet(viewsets.ModelViewSet):
    """관리자용 유저 관리 ViewSet"""
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = AdminPagination

    def get_queryset(self):
        queryset = User.objects.all().order_by('-date_joined')
        
        # 검색 필터
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) | 
                Q(email__icontains=search)
            )
        
        # 상태 필터
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # 권한 필터
        is_staff = self.request.query_params.get('is_staff', None)
        if is_staff is not None:
            queryset = queryset.filter(is_staff=is_staff.lower() == 'true')
        
        return queryset

    @action(detail=True, methods=['post'])
    def set_role(self, request, pk=None):
        """유저 권한 변경"""
        user = self.get_object()
        role = request.data.get('role')
        
        if role == 'admin':
            user.is_staff = True
            user.is_superuser = True
        elif role == 'moderator':
            user.is_staff = True
            user.is_superuser = False
        elif role == 'user':
            user.is_staff = False
            user.is_superuser = False
        else:
            return Response({'error': 'Invalid role'}, status=400)
        
        user.save()
        return Response({
            'status': 'role updated',
            'user_id': user.id,
            'username': user.username,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser
        })

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """유저 활성/비활성 토글"""
        user = self.get_object()
        user.is_active = not user.is_active
        user.save()
        return Response({
            'status': 'active status updated',
            'user_id': user.id,
            'username': user.username,
            'is_active': user.is_active
        })

    @action(detail=True, methods=['delete'])
    def delete_user(self, request, pk=None):
        """유저 삭제 (관련 데이터 포함)"""
        user = self.get_object()
        username = user.username
        
        try:
            # 관련 데이터 삭제
            ChatRoomParticipant.objects.filter(user=user).delete()
            Chat.objects.filter(user_id=user.id).delete()
            MessageReaction.objects.filter(user=user).delete()
            PinnedMessage.objects.filter(pinned_by=user).delete()
            
            # 유저 삭제
            user.delete()
            
            return Response({
                'status': 'user deleted',
                'username': username
            })
        except Exception as e:
            return Response({
                'error': f'Failed to delete user: {str(e)}'
            }, status=500)


class AdminRoomViewSet(viewsets.ModelViewSet):
    """관리자용 방 관리 ViewSet"""
    queryset = ChatRoom.objects.all().order_by('-created_at')
    serializer_class = ChatRoomSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = AdminPagination

    def get_queryset(self):
        queryset = ChatRoom.objects.all().order_by('-created_at')
        
        # 검색 필터
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(name__icontains=search)
        
        # 타입 필터
        room_type = self.request.query_params.get('room_type', None)
        if room_type:
            queryset = queryset.filter(room_type=room_type)
        
        # 상태 필터
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # 공개/비공개 필터
        is_public = self.request.query_params.get('is_public', None)
        if is_public is not None:
            queryset = queryset.filter(is_public=is_public.lower() == 'true')
        
        return queryset

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """방 활성/비활성 토글"""
        room = self.get_object()
        room.is_active = not room.is_active
        room.save()
        return Response({
            'status': 'active status updated',
            'room_id': room.id,
            'room_name': room.name,
            'is_active': room.is_active
        })

    @action(detail=True, methods=['delete'])
    def delete_room(self, request, pk=None):
        """방 삭제 (관련 메시지 포함)"""
        room = self.get_object()
        room_name = room.name
        
        try:
            # 관련 메시지 삭제
            Chat.objects.filter(room=room).delete()
            PinnedMessage.objects.filter(room=room).delete()
            
            # 방 삭제
            room.delete()
            
            return Response({
                'status': 'room deleted',
                'room_name': room_name
            })
        except Exception as e:
            return Response({
                'error': f'Failed to delete room: {str(e)}'
            }, status=500)


class AdminMessageViewSet(viewsets.ModelViewSet):
    """관리자용 메시지 관리 ViewSet"""
    queryset = Chat.objects.all().order_by('-timestamp')
    serializer_class = ChatSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = AdminPagination

    def get_queryset(self):
        queryset = Chat.objects.all().order_by('-timestamp')
        
        # 검색 필터
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(content__icontains=search)
        
        # 방 필터
        room_id = self.request.query_params.get('room_id', None)
        if room_id:
            queryset = queryset.filter(room_id=room_id)
        
        # 발신자 타입 필터
        sender_type = self.request.query_params.get('sender_type', None)
        if sender_type:
            queryset = queryset.filter(sender_type=sender_type)
        
        # 유저 필터
        user_id = self.request.query_params.get('user_id', None)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        return queryset

    @action(detail=True, methods=['delete'])
    def delete_message(self, request, pk=None):
        """메시지 삭제 (관련 반응/답장 포함)"""
        message = self.get_object()
        
        try:
            # 관련 데이터 삭제
            MessageReaction.objects.filter(message=message).delete()
            MessageReply.objects.filter(original_message=message).delete()
            MessageReply.objects.filter(reply_message=message).delete()
            PinnedMessage.objects.filter(message=message).delete()
            
            # 메시지 삭제
            message.delete()
            
            return Response({
                'status': 'message deleted',
                'message_id': pk
            })
        except Exception as e:
            return Response({
                'error': f'Failed to delete message: {str(e)}'
            }, status=500)


class AdminStatsView(APIView):
    """관리자용 통계 API"""
    permission_classes = [IsAdminOrReadOnly]

    def get(self, request):
        """전체 통계 조회"""
        # 기본 통계
        user_count = User.objects.count()
        room_count = ChatRoom.objects.count()
        message_count = Chat.objects.count()
        
        # 활성 유저 수 (최근 30일)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        active_users = User.objects.filter(
            last_login__gte=thirty_days_ago
        ).count()
        
        # 최근 활동 통계
        today = timezone.now().date()
        today_messages = Chat.objects.filter(
            timestamp__date=today
        ).count()
        
        today_rooms = ChatRoom.objects.filter(
            created_at__date=today
        ).count()
        
        today_users = User.objects.filter(
            date_joined__date=today
        ).count()
        
        # 방 타입별 통계
        room_type_stats = ChatRoom.objects.values('room_type').annotate(
            count=Count('id')
        )
        
        # 메시지 타입별 통계
        message_type_stats = Chat.objects.values('sender_type').annotate(
            count=Count('id')
        )
        
        # 최근 메시지 (최근 10개)
        recent_messages = Chat.objects.select_related('room').order_by('-timestamp')[:10]
        recent_messages_data = []
        for msg in recent_messages:
            recent_messages_data.append({
                'id': msg.id,
                'content': msg.content[:100] + '...' if len(msg.content) > 100 else msg.content,
                'sender': msg.username or msg.ai_name or 'Unknown',
                'room_name': msg.room.name if msg.room else 'No Room',
                'timestamp': msg.timestamp,
                'sender_type': msg.sender_type
            })
        
        # 최근 유저 (최근 10개)
        recent_users = User.objects.order_by('-date_joined')[:10]
        recent_users_data = []
        for user in recent_users:
            recent_users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'date_joined': user.date_joined,
                'is_active': user.is_active,
                'is_staff': user.is_staff
            })
        
        return Response({
            'overview': {
                'total_users': user_count,
                'total_rooms': room_count,
                'total_messages': message_count,
                'active_users_30d': active_users
            },
            'today_stats': {
                'new_messages': today_messages,
                'new_rooms': today_rooms,
                'new_users': today_users
            },
            'room_type_stats': list(room_type_stats),
            'message_type_stats': list(message_type_stats),
            'recent_messages': recent_messages_data,
            'recent_users': recent_users_data
        })


class AdminBulkActionView(APIView):
    """관리자용 대량 액션 API"""
    permission_classes = [IsAdminOrReadOnly]

    def post(self, request):
        """대량 액션 실행"""
        action_type = request.data.get('action')
        target_ids = request.data.get('ids', [])
        
        if not action_type or not target_ids:
            return Response({
                'error': 'action and ids are required'
            }, status=400)
        
        try:
            if action_type == 'delete_users':
                deleted_count = User.objects.filter(id__in=target_ids).delete()[0]
                return Response({
                    'status': 'success',
                    'action': 'delete_users',
                    'deleted_count': deleted_count
                })
            
            elif action_type == 'delete_rooms':
                deleted_count = ChatRoom.objects.filter(id__in=target_ids).delete()[0]
                return Response({
                    'status': 'success',
                    'action': 'delete_rooms',
                    'deleted_count': deleted_count
                })
            
            elif action_type == 'delete_messages':
                deleted_count = Chat.objects.filter(id__in=target_ids).delete()[0]
                return Response({
                    'status': 'success',
                    'action': 'delete_messages',
                    'deleted_count': deleted_count
                })
            
            elif action_type == 'deactivate_users':
                updated_count = User.objects.filter(id__in=target_ids).update(is_active=False)
                return Response({
                    'status': 'success',
                    'action': 'deactivate_users',
                    'updated_count': updated_count
                })
            
            elif action_type == 'activate_users':
                updated_count = User.objects.filter(id__in=target_ids).update(is_active=True)
                return Response({
                    'status': 'success',
                    'action': 'activate_users',
                    'updated_count': updated_count
                })
            
            else:
                return Response({
                    'error': 'Invalid action type'
                }, status=400)
                
        except Exception as e:
            return Response({
                'error': f'Failed to execute bulk action: {str(e)}'
            }, status=500) 


# @method_decorator(csrf_exempt, name="dispatch")
class AdminMediaUploadView(APIView):    
    permission_classes = [IsAdminUser]
    # permission_classes = [AllowAny]
    
    def post(self, request):
        file = request.FILES.get('file')
        name = request.POST.get('name') or (file.name if file else None)
        if not file:
            return Response({"success": False, "error": "No file received"}, status=400)
        obj = MediaFile.objects.create(name=name, file=file)
        return Response({
            "success": True,
            "id": obj.id,
            "name": obj.name,
            "url": obj.file.url
        })


# @method_decorator(csrf_exempt, name="dispatch")
class AdminMediaListView(APIView):
    permission_classes = [permissions.IsAdminUser]
    # permission_classes = [AllowAny]

    def get(self, request):
        qs = MediaFile.objects.all().order_by('-uploaded_at')[:100]
        return Response(MediaFileSerializer(qs, many=True).data)


# @method_decorator(csrf_exempt, name="dispatch")
class AdminMediaDeleteView(APIView):
    permission_classes = [IsAdminUser]
    # permission_classes = [AllowAny]
    
    def delete(self, request, pk):
        print(f"AdminMediaDeleteView del pk: delete {pk}")
        try:
            obj = MediaFile.objects.get(pk=pk)
            obj.delete()
            return Response({"success": True})
        except MediaFile.DoesNotExist:
            return Response({"success": False, "error": "File not found"}, status=404)


class AdminMediaMultiDeleteView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        ids = request.data.get('ids', [])
        deleted = 0
        for pk in ids:
            try:
                obj = MediaFile.objects.get(pk=pk)
                obj.delete()
                deleted += 1
            except MediaFile.DoesNotExist:
                continue
        return Response({'success': True, 'deleted': deleted}) 
            