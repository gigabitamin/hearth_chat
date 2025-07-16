from rest_framework import serializers
from .models import ChatRoom, Chat, ChatRoomParticipant, UserSettings, VoiceCall
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