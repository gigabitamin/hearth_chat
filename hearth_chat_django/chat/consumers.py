import json
import os
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from dotenv import load_dotenv
from asgiref.sync import sync_to_async

load_dotenv()
from openai import OpenAI

class ChatConsumer(AsyncWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.session_id = None
        self.user_emotion_history = []  # 감정 변화 추적
        self.conversation_context = []  # 대화 컨텍스트 저장
    
    def _force_utf8mb4_connection(self):
        """MySQL 연결을 강제로 utf8mb4로 설정 (동기 버전)"""
        try:
            from django.db import connections
            connection = connections['default']
            
            if connection.connection is None:
                connection.ensure_connection()
            
            cursor = connection.cursor()
            
            # utf8mb4 강제 설정
            utf8mb4_commands = [
                "SET character_set_client=utf8mb4",
                "SET character_set_connection=utf8mb4",
                "SET character_set_results=utf8mb4", 
                "SET collation_connection=utf8mb4_unicode_ci",
                "SET NAMES utf8mb4",
                "SET sql_mode='STRICT_TRANS_TABLES'"
            ]
            
            for command in utf8mb4_commands:
                cursor.execute(command)
            
            cursor.close()            
            
        except Exception as e:
            print(f"MySQL utf8mb4 설정 오류: {e}")

    @sync_to_async
    def _force_utf8mb4_connection_async(self):
        """MySQL 연결을 강제로 utf8mb4로 설정 (비동기 안전 버전)"""
        return self._force_utf8mb4_connection()

    async def connect(self):
        await self.accept()
        # 세션 ID 생성
        self.session_id = str(uuid.uuid4())        
        
        # 대화방 목록 업데이트 그룹에 참여
        await self.channel_layer.group_add(
            'chat_room_list',
            self.channel_name
        )
        
        # MySQL 연결을 강제로 utf8mb4로 설정 (async context에서 안전하게)
        await self._force_utf8mb4_connection_async()

    async def disconnect(self, close_code):        
        
        # 대화방 목록 업데이트 그룹에서 나가기
        await self.channel_layer.group_discard(
            'chat_room_list',
            self.channel_name
        )

    async def receive(self, text_data):        
        if not text_data:
            await self.send(text_data=json.dumps({'message': "빈 메시지는 처리할 수 없습니다."}))
            return
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({'message': "잘못된 형식의 메시지입니다. JSON 형식으로 보내주세요."}))
            return
        
        # WebRTC 시그널링 메시지 처리
        message_type = data.get("type", "")
        if message_type in ["offer", "answer", "candidate", "participants_update"]:
            await self.handle_webrtc_signaling(data)
            return
        
        # 방 입장 메시지 처리
        if message_type == "join_room":
            room_id = data.get("roomId", "")
            if room_id:
                # 해당 방의 그룹에 참여
                await self.channel_layer.group_add(
                    f'chat_room_{room_id}',
                    self.channel_name
                )                
            return
        
        # 기존 채팅 메시지 처리
        user_message = data.get("message", "")
        user_emotion = data.get("emotion", "neutral")  # 감정 정보 추출
        image_url = data.get("imageUrl", "")
        image_urls = data.get("imageUrls", [])  # 다중 이미지 URL 배열
        room_id = data.get("roomId", "")  # 대화방 ID 추가
        
        # 단일 이미지 URL을 배열로 변환 (호환성 유지)
        if image_url and not image_urls:
            image_urls = [image_url]

        if not user_message and not image_urls:
            await self.send(text_data=json.dumps({'message': "메시지와 이미지가 모두 비어 있습니다."}))
            return

        # 감정 변화 추적
        self.update_emotion_history(user_emotion)
        
        # 사용자 메시지를 DB에 저장 (감정 정보 포함)        
        user_obj = self.scope.get('user', None)
        # 첫 번째 이미지 URL을 사용 (호환성 유지)
        first_image_url = image_urls[0] if image_urls else image_url
        # imageUrls를 JSON으로 저장
        image_urls_json = json.dumps(image_urls) if image_urls else None
        user_message_obj = await self.save_user_message(user_message or '[이미지 첨부]', room_id, user_emotion, user_obj, first_image_url, image_urls_json)        
        try:
            debug_event = {
                'type': 'user_message',
                'message': user_message or '[이미지 첨부]',
                'roomId': room_id,
                'sender': (
                    user_message_obj.username if user_message_obj and hasattr(user_message_obj, 'sender_type') and user_message_obj.sender_type == 'user' else (
                        user_message_obj.ai_name if user_message_obj and hasattr(user_message_obj, 'sender_type') and user_message_obj.sender_type == 'ai' else 'System'
                    )
                ) if user_message_obj else 'Unknown',
                'user_id': user_message_obj.user_id if user_message_obj and hasattr(user_message_obj, 'user_id') else None,
                'timestamp': user_message_obj.timestamp.isoformat() if user_message_obj and hasattr(user_message_obj, 'timestamp') else None,
                'emotion': user_emotion,
                'imageUrl': first_image_url,  # 첫 번째 이미지 URL
                'imageUrls': image_urls  # 다중 이미지 URL 배열 추가
            }            
        except Exception as e:
            print(f"[DEBUG][group_send][user_message] event 출력 오류: {e}")
        await self.channel_layer.group_send(
            f'chat_room_{room_id}',
            {
                'type': 'user_message',
                'message': user_message or '[이미지 첨부]',
                'roomId': room_id,
                'sender': (
                    user_message_obj.username if user_message_obj.sender_type == 'user' else (
                        user_message_obj.ai_name if user_message_obj.sender_type == 'ai' else 'System'
                    )
                ),
                'user_id': user_message_obj.user_id if hasattr(user_message_obj, 'user_id') else None,  # user_id 추가
                'timestamp': user_message_obj.timestamp.isoformat(),
                'emotion': user_emotion,
                'imageUrl': first_image_url,  # 첫 번째 이미지 URL (호환성 유지)
                'imageUrls': image_urls  # 다중 이미지 URL 배열 추가
            }
        )

        # AI 응답 ON/OFF 분기 처리
        from asgiref.sync import sync_to_async
        @sync_to_async
        def get_ai_response_enabled(user):
            from .models import UserSettings
            try:
                settings = UserSettings.objects.get(user=user)
                return settings.ai_response_enabled
            except Exception:
                return True  # 기본값 True

        user = getattr(self, 'scope', {}).get('user', None)
        ai_response_enabled = True
        if user and hasattr(user, 'is_authenticated') and user.is_authenticated:
            ai_response_enabled = await get_ai_response_enabled(user)
        if not ai_response_enabled:
            # print('[AI 응답 OFF] 사용자 설정에 따라 AI 응답을 건너뜁니다.')
            return

        try:            
            # 모든 이미지 URL을 AI 응답에 전달
            ai_response_result = await self.get_ai_response(user_message, user_emotion, image_urls)            
            
            # AI 응답 결과에서 정보 추출
            ai_response = ai_response_result['response']
            actual_provider = ai_response_result['provider']
            ai_name = ai_response_result['ai_name']
            ai_type = ai_response_result['ai_type']
            
            print(f"✅ 실제 사용된 API: {actual_provider}, AI 이름: {ai_name}")
            
            # AI 응답을 DB에 저장 (question_message를 명시적으로 전달)
            ai_message_obj = await self.save_ai_message(
                ai_response, 
                room_id, 
                ai_name=ai_name, 
                ai_type=ai_type, 
                question_message=user_message_obj  # user_message_obj를 명시적으로 전달
            )
            
            # FK select_related로 새로 불러오기
            from .models import Chat
            ai_message_obj = await sync_to_async(lambda: Chat.objects.select_related('question_message').get(id=ai_message_obj.id))()

            # 대화 컨텍스트 업데이트
            self.conversation_context.append({
                "user": {"message": user_message, "emotion": user_emotion, "image": image_url},
                "ai": {"message": ai_response}
            })
            
            # 컨텍스트가 너무 길어지면 최근 10개만 유지
            if len(self.conversation_context) > 10:
                self.conversation_context = self.conversation_context[-10:]
            
            # AI 응답을 방의 모든 참여자에게 브로드캐스트
            print(f"📤 AI 응답 전송 준비: {ai_response[:50]}...")
            print(f"📤 방 ID: {room_id}")
            print(f"📤 AI 이름: {ai_name}")
            
            try:
                debug_event = {
                    'type': 'ai_message',
                    'message': ai_response,
                    'roomId': room_id,
                    'timestamp': ai_message_obj.timestamp.isoformat() if ai_message_obj and hasattr(ai_message_obj, 'timestamp') else None,
                    'questioner_username': (
                        ai_message_obj.question_message.username if ai_message_obj and ai_message_obj.question_message else None
                    ),
                    'ai_name': ai_message_obj.ai_name if ai_message_obj else 'AI',
                    'sender': ai_message_obj.ai_name if ai_message_obj else 'AI',
                }
                print(f"📤 디버그 이벤트: {debug_event}")
            except Exception as e:
                print(f"[DEBUG][group_send][ai_message] event 출력 오류: {e}")
            
            # WebSocket을 통해 AI 응답 전송
            await self.channel_layer.group_send(
                f'chat_room_{room_id}',
                {
                    'type': 'ai_message',
                    'sender_type': ai_message_obj.sender_type if hasattr(ai_message_obj, 'sender_type') else 'ai',
                    'message': ai_response,
                    'roomId': room_id,
                    'timestamp': ai_message_obj.timestamp.isoformat(),
                    'questioner_username': (
                        ai_message_obj.question_message.username if ai_message_obj and ai_message_obj.question_message else None
                    ),
                    'ai_name': ai_message_obj.ai_name if ai_message_obj else 'AI',
                    'sender': ai_message_obj.ai_name if ai_message_obj else 'AI',
                    'imageUrls': image_urls  # 원본 이미지 URL 배열 추가
                }
            )
            print(f"✅ AI 응답 WebSocket 전송 완료")
        except Exception as e:            
            error_message = f"AI 오류: {str(e)}"
            await self.save_ai_message(error_message, room_id)
            await self.send(text_data=json.dumps({
                'message': error_message,
                'roomId': room_id,
                'type': 'chat_message'
            }))

    async def room_list_update(self, event):
        """대화방 목록 업데이트 메시지 처리"""
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'room_list_update',
            'data': message
        }))

    async def user_message(self, event):        
        try:
            debug_event = dict(event) if isinstance(event, dict) else event            
        except Exception as e:
            print(f"[DEBUG][self.send][user_message] event 출력 오류: {e}")
        await self.send(text_data=json.dumps({
            'type': 'user_message',
            'message': event['message'],
            'roomId': event['roomId'],
            'sender': event['sender'],
            'user_id': event.get('user_id'),  # user_id 필드 추가
            'timestamp': event['timestamp'],
            'emotion': event.get('emotion', 'neutral'),
            'imageUrl': event.get('imageUrl', ''),  # imageUrl 추가
            'imageUrls': event.get('imageUrls', [])  # imageUrls 배열 추가
        }))

    async def ai_message(self, event):        
        print(f"📥 AI 메시지 이벤트 수신: {event}")
        try:
            debug_event = dict(event) if isinstance(event, dict) else event            
        except Exception as e:
            print(f"[DEBUG][self.send][ai_message] event 출력 오류: {e}")
        
        # WebSocket을 통해 클라이언트로 전송
        response_data = {
            'type': 'ai_message',
            'message': event['message'],
            'roomId': event['roomId'],
            'timestamp': event['timestamp'],
            'questioner_username': event.get('questioner_username'),
            'ai_name': event.get('ai_name', 'AI'),
            'sender': event.get('ai_name', 'AI'),
            'imageUrls': event.get('imageUrls', [])  # imageUrls 배열 추가
        }
        print(f"📤 클라이언트로 전송할 데이터: {response_data}")
        
        await self.send(text_data=json.dumps(response_data))
        print(f"✅ AI 메시지 클라이언트 전송 완료")

    async def handle_webrtc_signaling(self, data):
        """WebRTC 시그널링 메시지 처리"""
        message_type = data.get("type", "")
        target_user = data.get("targetUser", "")
        sender_user = data.get("senderUser", "")                
        
        # 시그널링 메시지를 해당 사용자에게 전달
        if target_user and target_user != sender_user:
            # 실제 구현에서는 사용자별 WebSocket 연결을 관리해야 함
            # 현재는 모든 연결된 클라이언트에게 브로드캐스트
            await self.send(text_data=json.dumps({
                "type": message_type,
                "senderUser": sender_user,
                "targetUser": target_user,
                "data": data.get("data", {}),
                "candidate": data.get("candidate", {}),
                "sdp": data.get("sdp", "")
            }))
        else:
            # 참가자 목록 업데이트 등 전체 브로드캐스트
            await self.send(text_data=json.dumps(data))

    def update_emotion_history(self, current_emotion):
        """감정 변화 추적"""
        self.user_emotion_history.append(current_emotion)
        # 최근 5개의 감정만 유지
        if len(self.user_emotion_history) > 5:
            self.user_emotion_history = self.user_emotion_history[-5:]

    def get_emotion_trend(self):
        """감정 변화 추세 분석"""
        if len(self.user_emotion_history) < 2:
            return "stable"
        
        recent_emotions = self.user_emotion_history[-3:]
        
        # 감정별 점수
        emotion_scores = {
            "happy": 3, "excited": 3, "joyful": 3,
            "sad": -2, "depressed": -2, "melancholy": -2,
            "angry": -1, "frustrated": -1, "irritated": -1,
            "anxious": -1, "worried": -1, "fearful": -1,
            "neutral": 0, "calm": 0, "peaceful": 0
        }
        
        scores = [emotion_scores.get(emotion, 0) for emotion in recent_emotions]
        avg_score = sum(scores) / len(scores)
        
        if avg_score > 1:
            return "improving"
        elif avg_score < -1:
            return "declining"
        else:
            return "stable"

    @sync_to_async
    def save_user_message(self, content, room_id, emotion="neutral", user=None, image_url=None, image_urls_json=None):
        """사용자 메시지를 DB에 저장 (감정 정보 포함)"""
        try:
            from .models import Chat
            # 이모지를 안전하게 처리하기 위해 유니코드 정규화
            if content:
                import unicodedata
                content = unicodedata.normalize('NFC', content)
            
            result = Chat.save_user_message(content, room_id, emotion, user, image_url, image_urls_json)            
            return result
        except Exception as e:
            print(f"사용자 메시지 저장 실패: {e}")
            # 커스텀 백엔드가 적용되지 않은 경우를 위한 디버깅
            print(f"커스텀 백엔드 디버깅 - 오류 타입: {type(e)}")
            print(f"커스텀 백엔드 디버깅 - 오류 내용: {str(e)}")
            raise e

    @sync_to_async
    def save_ai_message(self, content, room_id, ai_name='Gemini', ai_type='google', question_message=None):
        """AI 메시지를 DB에 저장"""
        try:
            from .models import Chat
            # 이모지를 안전하게 처리하기 위해 유니코드 정규화
            if content:
                import unicodedata
                content = unicodedata.normalize('NFC', content)
            # question_message를 반드시 넘김
            result = Chat.save_ai_message(content, room_id, ai_name=ai_name, ai_type=ai_type, question_message=question_message)
            print(f"AI 메시지 저장 성공: {result.id}, question_message: {question_message}")
            return result
        except Exception as e:
            print(f"AI 메시지 저장 실패: {e}")
            print(f"커스텀 백엔드 디버깅 - 오류 타입: {type(e)}")
            print(f"커스텀 백엔드 디버깅 - 오류 내용: {str(e)}")
            raise e

    @sync_to_async
    def get_user_ai_settings(self, user):
        """사용자의 AI 설정을 가져오기"""
        from .models import UserSettings
        try:
            settings = UserSettings.objects.get(user=user)
            if settings.ai_settings:
                try:
                    return json.loads(settings.ai_settings)
                except json.JSONDecodeError:
                    pass
            # 기본 설정 반환
            return {
                "aiProvider": "gemini",
                "aiEnabled": True
            }
        except Exception:
            # 기본 설정 반환
            return {
                "aiProvider": "gemini", 
                "aiEnabled": True
            }

    async def get_ai_response(self, user_message, user_emotion="neutral", image_urls=None):
        import base64
        import requests
        import os
        import json
        from django.conf import settings
        from openai import OpenAI

        @sync_to_async
        def call_lily_api(user_message, user_emotion, image_urls=None):
            """Lily LLM API 호출"""
            import requests
            try:
                # 사용자 설정에서 Lily API URL 가져오기
                user = getattr(self, 'scope', {}).get('user', None)
                ai_settings = None
                if user and hasattr(user, 'is_authenticated') and user.is_authenticated:
                    # 동기적으로 AI 설정 가져오기
                    from .models import UserSettings
                    try:
                        settings = UserSettings.objects.get(user=user)
                        if settings.ai_settings:
                            try:
                                ai_settings = json.loads(settings.ai_settings)
                            except json.JSONDecodeError:
                                pass
                    except Exception:
                        pass
                
                lily_api_url = ai_settings.get('lilyApiUrl', 'http://localhost:8001') if ai_settings else 'http://localhost:8001'
                lily_model = ai_settings.get('lilyModel', 'polyglot-ko-1.3b-chat') if ai_settings else 'polyglot-ko-1.3b-chat'
                
                # 감정 변화 추세 분석
                emotion_trend = self.get_emotion_trend()
                
                # 감정 전략 등 기존 코드 유지
                emotion_strategies = {
                    "happy": {"tone": "기쁨과 함께 공감하며", "approach": "사용자의 기쁨을 함께 나누고, 긍정적인 에너지를 더해주세요. 기쁜 일에 대해 더 자세히 이야기해보도록 유도하세요.", "examples": "정말 기뻐 보이네요! 😊 어떤 일이 그렇게 기쁘게 만든 거예요? 함께 기뻐해도 될까요?"},
                    "sad": {"tone": "따뜻하고 공감적으로", "approach": "사용자의 슬픔에 공감하고, 위로와 격려를 제공하세요. 슬픈 감정을 인정하고, 함께 극복할 방법을 찾아보세요.", "examples": "지금 많이 힘드시겠어요. 😔 그런 감정을 느끼는 것은 당연해요. 제가 옆에서 함께 있어드릴게요."},
                    "angry": {"tone": "차분하고 이해하는 태도로", "approach": "사용자의 분노를 인정하고, 차분하게 상황을 분석해보세요. 분노의 원인을 파악하고 해결책을 제시하세요.", "examples": "화가 나실 만해요. 😤 그런 상황이라면 누구라도 화가 날 거예요. 차분히 생각해보면 어떨까요?"},
                    "fearful": {"tone": "안심시키고 안전함을 느끼게", "approach": "사용자의 두려움을 인정하고, 안전함을 느끼게 해주세요. 구체적인 해결책이나 대안을 제시하세요.", "examples": "무서우시겠어요. 😰 걱정하지 마세요, 함께 해결해보아요. 어떤 부분이 가장 두려우신가요?"},
                    "surprised": {"tone": "함께 놀라워하며", "approach": "사용자의 놀라움에 함께 반응하고, 호기심을 나누어주세요. 놀라운 일에 대해 더 자세히 알아보세요.", "examples": "정말 놀라운 일이네요! 😲 저도 함께 놀랐어요. 어떻게 된 일인지 더 자세히 들려주세요!"},
                    "disgusted": {"tone": "이해하고 다른 주제로 전환", "approach": "사용자의 불쾌감을 인정하고, 다른 주제로 자연스럽게 전환하세요. 긍정적인 주제로 대화를 이어가세요.", "examples": "그런 일이 있으셨군요. 😕 다른 이야기로 기분 전환해볼까요? 요즘 즐거운 일은 없으셨나요?"},
                    "neutral": {"tone": "편안하고 자연스럽게", "approach": "평온한 상태를 유지하며, 자연스럽고 편안한 대화를 이어가세요. 관심사나 일상에 대해 이야기해보세요.", "examples": "편안한 하루 보내고 계시네요. 😊 오늘은 어떤 일이 있었나요? 이야기해주세요."}
                }
                strategy = emotion_strategies.get(user_emotion, emotion_strategies["neutral"])
                trend_guidance = {
                    "improving": "사용자의 기분이 좋아지고 있는 것 같아요. 이 긍정적인 흐름을 유지할 수 있도록 도와주세요.",
                    "declining": "사용자의 기분이 안 좋아지고 있는 것 같아요. 더 따뜻하고 지지적인 태도로 접근해주세요.",
                    "stable": "사용자의 감정 상태가 안정적입니다. 편안하고 일관된 톤으로 대화를 이어가주세요."
                }
                trend_guide = trend_guidance.get(emotion_trend, trend_guidance["stable"])
                context_summary = ""
                if len(self.conversation_context) > 0:
                    recent_context = self.conversation_context[-3:]
                    context_summary = "최근 대화 맥락: " + " | ".join([
                        f"사용자({ctx['user']['emotion']}): {ctx['user']['message'][:50]}..." for ctx in recent_context
                    ])
                
                system_content = f"""당신은 따뜻하고 공감적인 AI 대화상대입니다. \n벽난로 주변의 아늑한 공간에서 대화하는 것처럼 편안하고 따뜻한 톤으로 응답해주세요.\n\n현재 사용자의 감정 상태: {user_emotion}\n감정 변화 추세: {emotion_trend}\n\n응답 전략:\n- 톤: {strategy['tone']}\n- 접근법: {strategy['approach']}\n- 감정 변화 지침: {trend_guide}\n\n{context_summary}\n\n사용자의 감정에 맞춰 적절한 톤과 내용으로 응답해주세요. \n필요시 조언, 위로, 격려, 동조, 기쁨 등을 자연스럽게 표현하세요.\n이모티콘을 적절히 사용하여 감정을 표현하세요."""

                # Lily API 호출
                lily_url = f"{lily_api_url}/generate"
                
                # 다중 이미지 처리
                if image_urls and len(image_urls) > 0:
                    from urllib.parse import unquote
                    from django.conf import settings
                    print(f"🖼️ 다중 이미지 처리 시작: {len(image_urls)}개 이미지")
                    
                    files = {}
                    data = {
                        'prompt': user_message or "이 이미지들을 분석해줘.",
                        'max_length': 1000,
                        'temperature': 0.7
                    }
                    
                    for i, image_url in enumerate(image_urls):
                        try:
                            if image_url.startswith('/media/'):
                                rel_path = unquote(image_url.replace('/media/', ''))
                                file_path = os.path.normpath(os.path.join(settings.MEDIA_ROOT, rel_path))
                                print(f"📁 미디어 파일 경로 {i+1}: {file_path}")
                            else:
                                file_path = unquote(image_url)
                                print(f"📁 직접 파일 경로 {i+1}: {file_path}")
                            
                            if os.path.exists(file_path):
                                print(f"✅ 이미지 파일 {i+1} 존재 확인됨: {file_path}")
                                with open(file_path, 'rb') as f:
                                    img_bytes = f.read()
                                print(f"📊 이미지 {i+1} 크기: {len(img_bytes)} bytes")
                                
                                # 파일 확장자 추출
                                import mimetypes
                                mime_type, _ = mimetypes.guess_type(file_path)
                                if not mime_type or not mime_type.startswith('image/'):
                                    mime_type = 'image/png'
                                
                                # Form 데이터에 추가
                                files[f'image{i+1}'] = (f'image{i+1}.png', img_bytes, mime_type)
                            else:
                                print(f"❌ 이미지 파일 {i+1}이 존재하지 않음: {file_path}")
                        except Exception as e:
                            print(f"❌ 이미지 {i+1} 처리 오류: {e}")
                    
                    if not files:
                        print(f"🔄 모든 이미지 처리 실패, 텍스트 전용 요청으로 변경")
                        data = {
                            'prompt': user_message or "이미지 분석을 요청했지만 파일을 찾을 수 없습니다.",
                            'max_length': 1000,
                            'temperature': 0.7
                        }
                        files = None
                    else:
                        print(f"🔄 멀티모달 요청 준비 완료 ({len(files)}개 이미지 포함)")
                else:
                    # 텍스트만 요청
                    data = {
                        'prompt': user_message,
                        'max_length': 1000,
                        'temperature': 0.7
                    }
                    files = None

                print(f"🚀 Lily API 호출 시작: {lily_url}")
                print(f"📤 요청 데이터: {data}")
                print(f"📁 파일 포함 여부: {files is not None}")
                
                if files:
                    print(f"🔄 멀티모달 요청 전송 (이미지 포함)")
                    response = requests.post(lily_url, data=data, files=files, timeout=2200)
                else:
                    print(f"🔄 텍스트 전용 요청 전송")
                    response = requests.post(lily_url, data=data, timeout=200)
                
                print(f"📥 응답 상태: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    response_text = result.get('generated_text', 'Lily API에서 응답을 받지 못했습니다.')
                    print(f"✅ Lily API 응답 성공: {len(response_text)} 문자")
                    return response_text
                else:
                    print(f"❌ Lily API 오류: {response.status_code} - {response.text}")
                    raise Exception(f"Lily API 호출 실패: {response.status_code}")
                    
            except Exception as e:
                print(f"Lily API 호출 중 오류: {e}")
                raise e

        @sync_to_async
        def call_gemini(image_urls=None):            
            # 감정 변화 추세 분석
            emotion_trend = self.get_emotion_trend()
            # 감정 전략 등 기존 코드 유지
            emotion_strategies = {
                "happy": {"tone": "기쁨과 함께 공감하며", "approach": "사용자의 기쁨을 함께 나누고, 긍정적인 에너지를 더해주세요. 기쁜 일에 대해 더 자세히 이야기해보도록 유도하세요.", "examples": "정말 기뻐 보이네요! 😊 어떤 일이 그렇게 기쁘게 만든 거예요? 함께 기뻐해도 될까요?"},
                "sad": {"tone": "따뜻하고 공감적으로", "approach": "사용자의 슬픔에 공감하고, 위로와 격려를 제공하세요. 슬픈 감정을 인정하고, 함께 극복할 방법을 찾아보세요.", "examples": "지금 많이 힘드시겠어요. 😔 그런 감정을 느끼는 것은 당연해요. 제가 옆에서 함께 있어드릴게요."},
                "angry": {"tone": "차분하고 이해하는 태도로", "approach": "사용자의 분노를 인정하고, 차분하게 상황을 분석해보세요. 분노의 원인을 파악하고 해결책을 제시하세요.", "examples": "화가 나실 만해요. 😤 그런 상황이라면 누구라도 화가 날 거예요. 차분히 생각해보면 어떨까요?"},
                "fearful": {"tone": "안심시키고 안전함을 느끼게", "approach": "사용자의 두려움을 인정하고, 안전함을 느끼게 해주세요. 구체적인 해결책이나 대안을 제시하세요.", "examples": "무서우시겠어요. 😰 걱정하지 마세요, 함께 해결해보아요. 어떤 부분이 가장 두려우신가요?"},
                "surprised": {"tone": "함께 놀라워하며", "approach": "사용자의 놀라움에 함께 반응하고, 호기심을 나누어주세요. 놀라운 일에 대해 더 자세히 알아보세요.", "examples": "정말 놀라운 일이네요! 😲 저도 함께 놀랐어요. 어떻게 된 일인지 더 자세히 들려주세요!"},
                "disgusted": {"tone": "이해하고 다른 주제로 전환", "approach": "사용자의 불쾌감을 인정하고, 다른 주제로 자연스럽게 전환하세요. 긍정적인 주제로 대화를 이어가세요.", "examples": "그런 일이 있으셨군요. 😕 다른 이야기로 기분 전환해볼까요? 요즘 즐거운 일은 없으셨나요?"},
                "neutral": {"tone": "편안하고 자연스럽게", "approach": "평온한 상태를 유지하며, 자연스럽고 편안한 대화를 이어가세요. 관심사나 일상에 대해 이야기해보세요.", "examples": "편안한 하루 보내고 계시네요. 😊 오늘은 어떤 일이 있었나요? 이야기해주세요."}
            }
            strategy = emotion_strategies.get(user_emotion, emotion_strategies["neutral"])
            trend_guidance = {
                "improving": "사용자의 기분이 좋아지고 있는 것 같아요. 이 긍정적인 흐름을 유지할 수 있도록 도와주세요.",
                "declining": "사용자의 기분이 안 좋아지고 있는 것 같아요. 더 따뜻하고 지지적인 태도로 접근해주세요.",
                "stable": "사용자의 감정 상태가 안정적입니다. 편안하고 일관된 톤으로 대화를 이어가주세요."
            }
            trend_guide = trend_guidance.get(emotion_trend, trend_guidance["stable"])
            context_summary = ""
            if len(self.conversation_context) > 0:
                recent_context = self.conversation_context[-3:]
                context_summary = "최근 대화 맥락: " + " | ".join([
                    f"사용자({ctx['user']['emotion']}): {ctx['user']['message'][:50]}..." for ctx in recent_context
                ])
            system_content = f"""당신은 따뜻하고 공감적인 AI 대화상대입니다. \n벽난로 주변의 아늑한 공간에서 대화하는 것처럼 편안하고 따뜻한 톤으로 응답해주세요.\n\n현재 사용자의 감정 상태: {user_emotion}\n감정 변화 추세: {emotion_trend}\n\n응답 전략:\n- 톤: {strategy['tone']}\n- 접근법: {strategy['approach']}\n- 감정 변화 지침: {trend_guide}\n\n{context_summary}\n\n사용자의 감정에 맞춰 적절한 톤과 내용으로 응답해주세요. \n필요시 조언, 위로, 격려, 동조, 기쁨 등을 자연스럽게 표현하세요.\n이모티콘을 적절히 사용하여 감정을 표현하세요."""

            # 1. 이미지가 포함된 경우: 먼저 OpenAI 라이브러리 방식 시도
            if image_urls and len(image_urls) > 0:
                from urllib.parse import unquote
                try:
                    # 첫 번째 이미지 사용
                    image_url = image_urls[0]
                    # image_url이 /media/... 형태라면 MEDIA_ROOT에서 파일 경로 추출 (unquote 적용)
                    if image_url.startswith('/media/'):
                        rel_path = unquote(image_url.replace('/media/', ''))
                        file_path = os.path.normpath(os.path.join(settings.MEDIA_ROOT, rel_path))
                    else:
                        file_path = unquote(image_url)
                    
                    # 파일 존재 확인
                    if not os.path.exists(file_path):                        
                        # 파일이 없으면 텍스트만으로 처리
                        client = OpenAI(
                            api_key=os.environ.get("GEMINI_API_KEY"),
                            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
                        )
                        response = client.chat.completions.create(
                            model="gemini-2.5-flash",
                            messages=[
                                {"role": "system", "content": system_content},
                                {"role": "user", "content": user_message or "이미지 분석을 요청했지만 파일을 찾을 수 없습니다."}
                            ]
                        )                        
                        return response.choices[0].message.content
                    
                    # 파일을 base64로 읽어오기
                    with open(file_path, 'rb') as f:
                        img_bytes = f.read()
                    img_b64 = base64.b64encode(img_bytes).decode('utf-8')
                    
                    # OpenAI 라이브러리로 멀티모달 시도
                    client = OpenAI(
                        api_key=os.environ.get("GEMINI_API_KEY"),
                        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
                    )
                    response = client.chat.completions.create(
                        model="gemini-2.5-flash",
                        messages=[
                            {"role": "system", "content": system_content},
                            {"role": "user", "content": [
                                {"type": "text", "text": user_message or "이 이미지를 분석해줘."},
                                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
                            ]}
                        ]
                    )                    
                    return response.choices[0].message.content
                    
                except Exception as e:                    
                    # 백업: REST API 방식 시도
                    try:
                        GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
                        GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent"
                        
                        payload = {
                            "contents": [
                                {
                                    "parts": [
                                        {"text": user_message or "이 이미지를 분석해줘."},
                                        {
                                            "inline_data": {
                                                "mime_type": "image/png",
                                                "data": img_b64
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                        
                        response = requests.post(
                            GEMINI_API_URL + f"?key={GEMINI_API_KEY}",
                            headers={"Content-Type": "application/json"},
                            json=payload
                        )
                        response.raise_for_status()
                        result = response.json()
                        gemini_text = result["candidates"][0]["content"]["parts"][0]["text"]                        
                        return gemini_text
                        
                    except Exception as e2:                        
                        # 최종 백업: 텍스트만으로 처리
                        client = OpenAI(
                            api_key=os.environ.get("GEMINI_API_KEY"),
                            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
                        )
                        response = client.chat.completions.create(
                            model="gemini-2.5-flash",
                            messages=[
                                {"role": "system", "content": system_content},
                                {"role": "user", "content": user_message or "이미지 분석을 시도했지만 실패했습니다. 텍스트로만 응답드립니다."}
                            ]
                        )                        
                        return response.choices[0].message.content
            # 2. 텍스트-only: 기존 OpenAI 라이브러리 방식
            else:
                try:
                    client = OpenAI(
                        api_key=os.environ.get("GEMINI_API_KEY"),
                        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
                    )
                    response = client.chat.completions.create(
                        model="gemini-2.5-flash",
                        messages=[
                            {"role": "system", "content": system_content},
                            {"role": "user", "content": user_message}
                        ]
                    )                    
                    return response.choices[0].message.content
                except Exception as e:
                    print(f"[Gemini] 텍스트 응답 실패: {e}")                    

        # 사용자의 AI 설정에 따라 적절한 API 호출
        user = getattr(self, 'scope', {}).get('user', None)
        ai_settings = None
        if user and hasattr(user, 'is_authenticated') and user.is_authenticated:
            ai_settings = await self.get_user_ai_settings(user)
        
        ai_provider = ai_settings.get('aiProvider', 'gemini') if ai_settings else 'gemini'
        
        print(f"🔍 AI 설정 확인: {ai_provider}")
        
        try:
            if ai_provider == 'lily':
                print("🚀 Lily LLM API 호출")
                response_text = await call_lily_api(user_message, user_emotion, image_urls)
                return {
                    'response': response_text,
                    'provider': 'lily',
                    'ai_name': 'Lily LLM',
                    'ai_type': 'lily'
                }
            else:
                print("🚀 Gemini API 호출")
                response_text = await call_gemini(image_urls)
                return {
                    'response': response_text,
                    'provider': 'gemini',
                    'ai_name': 'Gemini',
                    'ai_type': 'google'
                }
        except Exception as e:
            print(f"❌ {ai_provider} API 호출 실패: {e}")
            # 실패 시 Gemini로 폴백
            if ai_provider != 'gemini':
                print("🔄 Gemini API로 폴백")
                try:
                    response_text = await call_gemini()
                    return {
                        'response': response_text,
                        'provider': 'gemini',
                        'ai_name': 'Gemini',
                        'ai_type': 'google'
                    }
                except Exception as fallback_e:
                    print(f"❌ Gemini 폴백도 실패: {fallback_e}")
                    raise fallback_e
            else:
                raise e
