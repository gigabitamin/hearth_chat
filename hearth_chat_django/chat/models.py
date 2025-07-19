from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.contrib.sites.models import Site

# Create your models here.

class ChatRoom(models.Model):
    """대화방 모델"""
    ROOM_TYPE_CHOICES = [
        ('ai', 'AI 채팅'),
        ('user', '1:1 개인 채팅'),
        ('group', '그룹 채팅'),
        ('public', '공개 오픈 채팅'),
        ('voice', '음성 통화'),
    ]
    
    name = models.CharField(max_length=100, verbose_name='대화방 이름', unique=True)
    room_type = models.CharField(max_length=10, choices=ROOM_TYPE_CHOICES, verbose_name='대화방 타입')
    ai_provider = models.CharField(max_length=20, blank=True, null=True, verbose_name='AI 제공자')  # GEMINI, CHATGPT, CLUDE 등
    
    # 공개/비공개 설정
    is_public = models.BooleanField(default=False, verbose_name='공개 방 여부')
    
    # AI 응답 활성화 여부
    ai_response_enabled = models.BooleanField(default=False, verbose_name='AI 응답 활성화')
    
    # 대화방 참여자들
    participants = models.ManyToManyField(User, through='ChatRoomParticipant', verbose_name='참여자들')
    
    # 대화방 설정
    is_active = models.BooleanField(default=True, verbose_name='활성 상태')
    is_voice_call = models.BooleanField(default=False, verbose_name='음성 통화 여부')
    max_members = models.PositiveIntegerField(default=4, verbose_name='최대 인원수')
    
    # 즐겨찾기 사용자
    favorite_users = models.ManyToManyField(User, related_name='favorite_rooms', blank=True)
    
    # 메타 정보
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성 시간')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정 시간')
    
    class Meta:
        ordering = ['-updated_at']
        verbose_name = '대화방'
        verbose_name_plural = '대화방들'
        db_table = 'chat_chatroom'
        indexes = [
            models.Index(fields=['room_type', 'is_public']),
            models.Index(fields=['is_active', 'updated_at']),
            models.Index(fields=['name']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.get_room_type_display()})"
    
    @classmethod
    def create_ai_chat_room(cls, user, ai_provider='GEMINI'):
        """AI 채팅방 생성"""
        room_name = f"{ai_provider}와의 대화"
        room = cls.objects.create(
            name=room_name,
            room_type='ai',
            ai_provider=ai_provider
        )
        # 사용자를 참여자로 추가
        ChatRoomParticipant.objects.create(
            room=room,
            user=user,
            is_owner=True
        )
        return room
    
    @classmethod
    def create_user_chat_room(cls, user1, user2):
        """1:1 사용자 채팅방 생성 (비공개)"""
        room_name = f"{user1.username}와 {user2.username}의 대화"
        room = cls.objects.create(
            name=room_name,
            room_type='user',
            is_public=False
        )
        # 두 사용자를 참여자로 추가
        ChatRoomParticipant.objects.create(room=room, user=user1, is_owner=True)
        ChatRoomParticipant.objects.create(room=room, user=user2)
        return room
    
    @classmethod
    def create_public_chat_room(cls, creator, name, room_type='public'):
        """공개 오픈 채팅방 생성"""
        room = cls.objects.create(
            name=name,
            room_type=room_type,
            is_public=True
        )
        # 생성자를 참여자로 추가
        ChatRoomParticipant.objects.create(room=room, user=creator, is_owner=True)
        return room

class ChatRoomParticipant(models.Model):
    """대화방 참여자 모델"""
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, verbose_name='대화방')
    user = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name='사용자')
    is_owner = models.BooleanField(default=False, verbose_name='방장 여부')
    joined_at = models.DateTimeField(auto_now_add=True, verbose_name='참여 시간')
    
    class Meta:
        unique_together = ['room', 'user']
        verbose_name = '대화방 참여자'
        verbose_name_plural = '대화방 참여자들'
        db_table = 'chat_chatroomparticipant'
    
    def __str__(self):
        return f"{self.user.username} - {self.room.name}"

class Chat(models.Model):
    MESSAGE_TYPE_CHOICES = [
        ('text', '텍스트'),
        ('image', '이미지'),
        ('system', '시스템'),
    ]
    SENDER_TYPE_CHOICES = [
        ('user', '사용자'),
        ('ai', 'AI'),
        ('system', '시스템'),
    ]
    # 대화방 연결
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, verbose_name='대화방', null=True, blank=True)
    # sender(기존) 대신 아래 필드 사용
    sender_type = models.CharField(max_length=10, choices=SENDER_TYPE_CHOICES, verbose_name='발신자 타입')  # user, ai, system
    username = models.CharField(max_length=100, null=True, blank=True, verbose_name='유저 이름')  # user일 때만
    user_id = models.BigIntegerField(null=True, blank=True, verbose_name='유저 ID')  # user일 때만
    ai_name = models.CharField(max_length=50, null=True, blank=True, verbose_name='AI 이름')  # ai일 때만 (gpt, gemini, clude 등)
    ai_type = models.CharField(max_length=50, null=True, blank=True, verbose_name='AI 타입')  # ai일 때만 (openai, google 등)
    question_message = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ai_responses',
        verbose_name='AI 응답을 유발한 질문 메시지'
    )
    # 메시지 정보
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPE_CHOICES, verbose_name='메시지 타입')  # text, image, system 등
    # content = models.TextField(verbose_name='메시지 내용')
    content = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now, verbose_name='전송 시간')
    # 세션 관리 (나중에 사용자별 구분을 위해)
    session_id = models.CharField(max_length=100, blank=True, null=True, verbose_name='세션 ID')
    # 감정 정보 (사용자 메시지에만 적용)
    emotion = models.CharField(max_length=20, blank=True, null=True, verbose_name='감정 상태')
    # 이미지 파일 경로 (선택적)
    attach_image = models.ImageField(
        upload_to='image/chat_attach/',  # 원하는 하위 폴더 경로
        blank=True, null=True, verbose_name='첨부 이미지'
    )
    # 메타 정보
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성 시간')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정 시간')
    class Meta:
        ordering = ['timestamp']
        verbose_name = '채팅 메시지'
        verbose_name_plural = '채팅 메시지들'
        db_table = 'chat_chat'
        indexes = [
            models.Index(fields=['room', 'timestamp']),
            models.Index(fields=['sender_type', 'timestamp']),
            models.Index(fields=['username']),
            # models.Index(fields=['content']),
            models.Index(fields=['created_at']),
        ]
    def __str__(self):
        if self.sender_type == 'user':
            sender = self.username or f"User({self.user_id})"
        elif self.sender_type == 'ai':
            sender = self.ai_name or self.ai_type or 'AI'
        else:
            sender = '시스템'
        return f"{sender} - {self.get_message_type_display()} - {self.content[:50]}..."
    
    @classmethod
    def save_user_message(cls, content, session_id=None, emotion=None, user=None):
        """사용자 메시지 저장 (감정 정보 포함)"""
        room_id = session_id
        if room_id and str(room_id).isdigit():
            try:
                room = ChatRoom.objects.get(id=int(room_id))
            except ChatRoom.DoesNotExist:
                room = ChatRoom.objects.filter(room_type='ai').first()
                if not room:
                    room = ChatRoom.create_ai_chat_room(User.objects.first(), 'GEMINI')
        else:
            room = ChatRoom.objects.filter(room_type='ai').first()
            if not room:
                room = ChatRoom.create_ai_chat_room(User.objects.first(), 'GEMINI')
        username = user.username if user and hasattr(user, 'username') else None
        user_id = user.id if user and hasattr(user, 'id') else None
        return cls.objects.create(
            room=room,
            sender_type='user',
            username=username,
            user_id=user_id,
            ai_name=None,
            ai_type=None,
            message_type='text',
            content=content,
            session_id=session_id,
            emotion=emotion
        )
    
    @classmethod
    def save_ai_message(cls, content, session_id=None, ai_name='Gemini', ai_type='google', question_message=None):
        """AI 메시지 저장"""
        room_id = session_id
        if room_id and str(room_id).isdigit():
            try:
                room = ChatRoom.objects.get(id=int(room_id))
            except ChatRoom.DoesNotExist:
                room = ChatRoom.objects.filter(room_type='ai').first()
                if not room:
                    room = ChatRoom.create_ai_chat_room(User.objects.first(), 'GEMINI')
        else:
            room = ChatRoom.objects.filter(room_type='ai').first()
            if not room:
                room = ChatRoom.create_ai_chat_room(User.objects.first(), 'GEMINI')
        return cls.objects.create(
            room=room,
            sender_type='ai',
            username=None,
            user_id=None,
            ai_name=ai_name,
            ai_type=ai_type,
            message_type='text',
            content=content,
            session_id=session_id,
            question_message=question_message
        )
    
    @classmethod
    def get_recent_messages(cls, room, limit=20, offset=0):
        """최근 메시지 조회 (페이지네이션)"""
        return cls.objects.filter(room=room).order_by('-timestamp')[offset:offset+limit]
    
    @classmethod
    def get_message_count(cls, room):
        """대화방의 총 메시지 수"""
        return cls.objects.filter(room=room).count()

class UserSettings(models.Model):
    """사용자 설정 모델"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, verbose_name='사용자')
    
    # TTS 설정
    tts_enabled = models.BooleanField(default=True, verbose_name='TTS 활성화')
    tts_voice = models.CharField(max_length=50, default='ko-KR', verbose_name='TTS 음성')
    tts_speed = models.FloatField(default=1.0, verbose_name='TTS 속도')
    
    # 음성 인식 설정
    voice_recognition_enabled = models.BooleanField(default=True, verbose_name='음성 인식 활성화')
    auto_send_enabled = models.BooleanField(default=True, verbose_name='자동 전송 활성화')
    voice_confidence_threshold = models.FloatField(default=0.7, verbose_name='음성 인식 신뢰도 임계값')
    
    # 카메라 설정
    camera_enabled = models.BooleanField(default=False, verbose_name='카메라 활성화')
    
    # 아바타 설정
    ai_avatar_enabled = models.BooleanField(default=True, verbose_name='AI 아바타 활성화')
    user_avatar_enabled = models.BooleanField(default=False, verbose_name='사용자 아바타 활성화')
    
    # AI 응답 설정
    ai_response_enabled = models.BooleanField(default=True, verbose_name='AI 응답 활성화')
    
    # 기타 설정
    theme = models.CharField(max_length=20, default='dark', verbose_name='테마')
    language = models.CharField(max_length=10, default='ko', verbose_name='언어')
    
    # 메타 정보
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성 시간')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정 시간')
    
    class Meta:
        verbose_name = '사용자 설정'
        verbose_name_plural = '사용자 설정들'
        db_table = 'chat_usersettings'
    
    def __str__(self):
        return f"{self.user.username}의 설정"
    
    @classmethod
    def get_or_create_settings(cls, user):
        """사용자 설정 가져오기 (없으면 생성)"""
        settings, created = cls.objects.get_or_create(user=user)
        return settings

class VoiceCall(models.Model):
    """음성 통화 모델"""
    CALL_STATUS_CHOICES = [
        ('waiting', '대기 중'),
        ('active', '통화 중'),
        ('ended', '종료'),
        ('missed', '부재중'),
    ]
    
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, verbose_name='대화방')
    caller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='outgoing_calls', verbose_name='발신자')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='incoming_calls', verbose_name='수신자')
    
    status = models.CharField(max_length=10, choices=CALL_STATUS_CHOICES, default='waiting', verbose_name='통화 상태')
    start_time = models.DateTimeField(auto_now_add=True, verbose_name='시작 시간')
    end_time = models.DateTimeField(null=True, blank=True, verbose_name='종료 시간')
    duration = models.IntegerField(default=0, verbose_name='통화 시간(초)')
    
    class Meta:
        verbose_name = '음성 통화'
        verbose_name_plural = '음성 통화들'
        db_table = 'chat_voicecall'
    
    def __str__(self):
        return f"{self.caller.username} → {self.receiver.username} ({self.get_status_display()})"
    
    def end_call(self):
        """통화 종료"""
        from django.utils import timezone
        self.end_time = timezone.now()
        self.duration = int((self.end_time - self.start_time).total_seconds())
        self.status = 'ended'
        self.save()

class MessageReaction(models.Model):
    """메시지 반응 모델"""
    message = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='reactions', verbose_name='메시지')
    user = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name='사용자')
    emoji = models.CharField(max_length=10, verbose_name='이모지')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='반응 시간')
    
    class Meta:
        unique_together = ['message', 'user', 'emoji']
        verbose_name = '메시지 반응'
        verbose_name_plural = '메시지 반응들'
        db_table = 'chat_messagereaction'
    
    def __str__(self):
        return f"{self.user.username} - {self.emoji} on message {self.message.id}"

class MessageReply(models.Model):
    """메시지 답장 모델"""
    original_message = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='replies', verbose_name='원본 메시지')
    reply_message = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='reply_to', verbose_name='답장 메시지')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='답장 시간')
    
    class Meta:
        verbose_name = '메시지 답장'
        verbose_name_plural = '메시지 답장들'
        db_table = 'chat_messagereply'
    
    def __str__(self):
        return f"Reply to message {self.original_message.id}"

class PinnedMessage(models.Model):
    """고정된 메시지 모델"""
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='pinned_messages', verbose_name='대화방')
    message = models.ForeignKey(Chat, on_delete=models.CASCADE, verbose_name='고정된 메시지')
    pinned_by = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name='고정한 사용자')
    pinned_at = models.DateTimeField(auto_now_add=True, verbose_name='고정 시간')
    
    class Meta:
        unique_together = ['room', 'message']
        verbose_name = '고정된 메시지'
        verbose_name_plural = '고정된 메시지들'
        db_table = 'chat_pinnedmessage'
    
    def __str__(self):
        return f"Pinned message {self.message.id} in {self.room.name}"

class NotificationRead(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE)
    message = models.ForeignKey(Chat, on_delete=models.CASCADE, null=True, blank=True)
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'room', 'message')
        verbose_name = '알림 읽음 상태'
        verbose_name_plural = '알림 읽음 상태들'
        db_table = 'chat_notificationread'

    def __str__(self):
        return f"{self.user.username} - {self.room.name} - {self.message_id or 'room'}"

class MessageFavorite(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorite_messages')
    message = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='favorited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'message')
        db_table = 'chat_messagefavorite'
