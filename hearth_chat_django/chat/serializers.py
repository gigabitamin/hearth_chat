from rest_framework import serializers
from .models import ChatRoom, Chat, ChatRoomParticipant, UserSettings, VoiceCall, MessageReaction, MessageReply, PinnedMessage, NotificationRead
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_active', 'is_staff', 'is_superuser', 'date_joined', 'last_login']

class ChatRoomParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = ChatRoomParticipant
        fields = ['id', 'user', 'is_owner', 'joined_at']

class ChatRoomSerializer(serializers.ModelSerializer):
    participants = ChatRoomParticipantSerializer(many=True, source='chatroomparticipant_set', read_only=True)
    favorite_users = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    is_favorite = serializers.SerializerMethodField()
    latest_message = serializers.SerializerMethodField()
    participant_count = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = ['id', 'name', 'room_type', 'ai_provider', 'is_public', 'is_active', 'is_voice_call', 'max_members', 'participants', 'favorite_users', 'is_favorite', 'latest_message', 'participant_count', 'message_count', 'created_at', 'updated_at']

    def get_is_favorite(self, obj):
        user = self.context.get('request').user
        if user.is_authenticated:
            return obj.favorite_users.filter(id=user.id).exists()
        return False

    def get_latest_message(self, obj):
        last_msg = obj.chat_set.order_by('-timestamp').first()
        if last_msg:
            return {
                'content': last_msg.content,
                'timestamp': last_msg.timestamp,
                'sender': last_msg.username or last_msg.ai_name or '시스템',
                'message_type': last_msg.message_type,
            }
        return None

    def get_participant_count(self, obj):
        return obj.participants.count()

    def get_message_count(self, obj):
        return obj.chat_set.count()

class ChatSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    room_name = serializers.SerializerMethodField()
    sender_name = serializers.SerializerMethodField()
    reaction_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Chat
        fields = ['id', 'room', 'room_name', 'sender', 'sender_name', 'sender_type', 'username', 'user_id', 'ai_name', 'ai_type', 'message_type', 'content', 'timestamp', 'emotion', 'attach_image', 'reaction_count', 'created_at', 'updated_at']
    
    def get_room_name(self, obj):
        return obj.room.name if obj.room else 'No Room'
    
    def get_sender_name(self, obj):
        if obj.sender_type == 'user':
            return obj.username or f"User({obj.user_id})"
        elif obj.sender_type == 'ai':
            return obj.ai_name or obj.ai_type or 'AI'
        elif obj.sender_type == 'system':
            return 'System'
        else:
            return obj.username or obj.ai_name or 'Unknown'
    
    def get_reaction_count(self, obj):
        return obj.reactions.count()

class UserSettingsSerializer(serializers.ModelSerializer):
    tts_enabled = serializers.BooleanField(required=False)
    voice_recognition_enabled = serializers.BooleanField(required=False)
    camera_enabled = serializers.BooleanField(required=False)
    ai_avatar_enabled = serializers.BooleanField(required=False)
    user_avatar_enabled = serializers.BooleanField(required=False)
    auto_send_enabled = serializers.BooleanField(required=False)
    ai_response_enabled = serializers.BooleanField(required=False)    

    class Meta:
        model = UserSettings
        exclude = ['id', 'created_at', 'updated_at']

class VoiceCallSerializer(serializers.ModelSerializer):
    caller = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)
    class Meta:
        model = VoiceCall
        fields = ['id', 'room', 'caller', 'receiver', 'status', 'start_time', 'end_time', 'duration']

class MessageReactionSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = MessageReaction
        fields = ['id', 'message', 'user', 'emoji', 'created_at']

class MessageReplySerializer(serializers.ModelSerializer):
    original_message = serializers.PrimaryKeyRelatedField(queryset=Chat.objects.all())
    reply_message = serializers.PrimaryKeyRelatedField(queryset=Chat.objects.all())
    class Meta:
        model = MessageReply
        fields = ['id', 'original_message', 'reply_message', 'created_at']

class PinnedMessageSerializer(serializers.ModelSerializer):
    message = serializers.PrimaryKeyRelatedField(queryset=Chat.objects.all())
    pinned_by = UserSerializer(read_only=True)
    class Meta:
        model = PinnedMessage
        fields = ['id', 'room', 'message', 'pinned_by', 'pinned_at'] 

class NotificationReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationRead
        fields = ['id', 'user', 'room', 'message', 'read_at']
        read_only_fields = ['id', 'read_at', 'user'] 