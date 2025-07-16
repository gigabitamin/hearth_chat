from rest_framework import serializers
from .models import ChatRoom, Chat, ChatRoomParticipant, UserSettings, VoiceCall, MessageReaction, MessageReply, PinnedMessage, NotificationRead
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

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

    class Meta:
        model = ChatRoom
        fields = ['id', 'name', 'room_type', 'ai_provider', 'is_public', 'is_active', 'is_voice_call', 'participants', 'favorite_users', 'is_favorite', 'latest_message', 'created_at', 'updated_at']

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

class ChatSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    class Meta:
        model = Chat
        fields = ['id', 'room', 'sender', 'message_type', 'content', 'timestamp', 'emotion', 'attach_image', 'created_at', 'updated_at']

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