import json
import os
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from dotenv import load_dotenv
from asgiref.sync import sync_to_async
from openai import OpenAI

load_dotenv()

max_length = 64

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
        documents = data.get("documents", [])  # 문서 정보 배열
        room_id = data.get("roomId", "")  # 대화방 ID 추가

        print(f"[DEBUG] WebSocket 메시지 수신:")
        print(f"[DEBUG] user_message: {user_message}")
        print(f"[DEBUG] image_urls: {image_urls}")
        print(f"[DEBUG] documents: {documents}")
        print(f"[DEBUG] room_id: {room_id}")
        
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
            # 클라이언트에서 넘어온 AI 설정이 있으면 우선 적용하도록 전달
            client_ai_settings = {
                'aiProvider': data.get('aiProvider'),
                'lilyApiUrl': data.get('lilyApiUrl'),
                'lilyModel': data.get('lilyModel'),
                'geminiModel': data.get('geminiModel'),
            }
            # None 값 제거
            client_ai_settings = {k: v for k, v in client_ai_settings.items() if v is not None}

            ai_response_result = await self.get_ai_response(
                user_message,
                user_emotion,
                image_urls,
                documents,
                client_ai_settings=client_ai_settings if client_ai_settings else None,
            )            
            
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
            print(f"🔍 DB에서 가져온 설정: ai_provider={settings.ai_provider}, gemini_model={settings.gemini_model}")
            
            # 기본 설정
            default_settings = {
                "aiProvider": "gemini",
                "aiEnabled": True,
                "geminiModel": "gemini-1.5-flash"
            }
            
            # ai_settings JSON에서 설정 가져오기
            if settings.ai_settings:
                try:
                    json_settings = json.loads(settings.ai_settings)
                    default_settings.update(json_settings)
                    print(f"🔍 JSON 설정에서 가져온 값: {json_settings}")
                except json.JSONDecodeError:
                    print(f"🔍 JSON 파싱 오류")
                    pass
            
            # 새로운 필드들 추가 (DB 필드 우선)
            if hasattr(settings, 'ai_provider') and settings.ai_provider:
                default_settings["aiProvider"] = settings.ai_provider
                print(f"🔍 DB ai_provider 사용: {settings.ai_provider}")
            if hasattr(settings, 'gemini_model') and settings.gemini_model:
                default_settings["geminiModel"] = settings.gemini_model
                print(f"🔍 DB gemini_model 사용: {settings.gemini_model}")
            
            print(f"🔍 최종 설정: {default_settings}")
            return default_settings
        except Exception as e:
            print(f"🔍 설정 가져오기 오류: {e}")
            # 기본 설정 반환
            return {
                "aiProvider": "gemini", 
                "aiEnabled": True,
                "geminiModel": "gemini-1.5-flash"
            }

    async def get_ai_response(self, user_message, user_emotion="neutral", image_urls=None, documents=None, client_ai_settings=None):
        import base64
        import requests
        import os
        import json
        from django.conf import settings
        from openai import OpenAI

        @sync_to_async
        def call_lily_api(user_message, user_emotion, image_urls=None, documents=None):
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
                
                # 환경별 기본 URL 설정
                from django.conf import settings
                default_lily_url = getattr(settings, 'LILY_API_URL', 'http://localhost:8001')
                print(f"🔧 Lily URL={default_lily_url}")
                default_lily_model = 'kanana-1.5-v-3b-instruct'
                
                lily_api_url = ai_settings.get('lilyApiUrl', default_lily_url) if ai_settings else default_lily_url
                lily_model = ai_settings.get('lilyModel', default_lily_model) if ai_settings else default_lily_model
                
                print(f"🔧 Lily API 설정: URL={lily_api_url}, Model={lily_model}")
                print(f"🔧 환경 감지: RAILWAY_ENVIRONMENT={os.environ.get('RAILWAY_ENVIRONMENT', 'None')}")
                
                # 감정 변화 추세 분석
                emotion_trend = self.get_emotion_trend()
                
                # 감정 전략 등 기존 코드 유지
                emotion_strategies = {
                    "happy": {"tone": "기쁨과 함께 공감하며", "approach": "사용자의 기쁨을 함께 나누고, 긍정적인 에너지를 더해주세요. 기쁜 일에 대해 더 자세히 이야기해보도록 유도하세요.", "examples": "정말 기뻐 보이네요! 😊 어떤 일이 그렇게 기쁘게 만든 거예요? 함께 기뻐해도 될까요?"},
                    "sad": {"tone": "따뜻하고 공감적으로", "approach": "사용자의 슬픔에 공감하고, 위로와 격려를 제공하세요. 슬픈 감정을 인정하고, 함께 극복할 방법을 찾아보세요.", "examples": "지금 많이 힘드시겠어요. 😔 그런 감정을 느끼는 것은 당연해요. 제가 옆에서 함께 있어드릴게요."},
                    "angry": {"tone": "차분하고 이해하며", "approach": "사용자의 분노를 인정하고, 차분하게 상황을 분석해보세요. 분노의 원인을 찾고 해결책을 제시하세요.", "examples": "화가 나시는 것 같아요. 😤 어떤 일이 그렇게 화나게 만든 거예요? 함께 해결책을 찾아보시죠."},
                    "surprised": {"tone": "놀라움을 함께하며", "approach": "사용자의 놀라움에 공감하고, 그 상황에 대해 더 자세히 알아보세요. 새로운 관점을 제시하세요.", "examples": "정말 놀라운 일이었나 보네요! 😮 어떤 일이 그렇게 놀라게 만든 거예요? 더 자세히 들려주세요."},
                    "fearful": {"tone": "안심시키며", "approach": "사용자의 두려움을 인정하고, 안심시켜주세요. 구체적인 해결책과 지원을 제시하세요.", "examples": "걱정되시는 것 같아요. 😰 어떤 일이 그렇게 걱정되게 만든 거예요? 함께 해결해보시죠."},
                    "disgusted": {"tone": "이해하며", "approach": "사용자의 혐오감을 인정하고, 그 상황에 대해 객관적으로 분석해보세요.", "examples": "정말 싫은 일이었나 보네요. 🤢 어떤 일이 그렇게 싫게 만든 거예요? 다른 관점에서 보면 어떨까요?"},
                    "neutral": {"tone": "편안하고 친근하게", "approach": "자연스럽고 편안한 대화를 이어가세요. 사용자의 관심사에 집중하고 유용한 정보를 제공하세요.", "examples": "편안한 대화를 나누고 싶으시군요. 😊 어떤 이야기를 나누고 싶으신가요?"}
                }
                
                # 현재 감정에 따른 전략 선택
                current_emotion = user_emotion.lower()
                strategy = emotion_strategies.get(current_emotion, emotion_strategies["neutral"])
                
                # 감정 변화 추세에 따른 추가 전략
                if emotion_trend == "improving":
                    strategy["approach"] += " 긍정적인 변화가 보이시네요. 계속해서 좋은 방향으로 나아가고 계세요."
                elif emotion_trend == "declining":
                    strategy["approach"] += " 요즘 힘드신 것 같아요. 제가 더 많이 도와드릴게요."
                
                # 프롬프트 구성
                emotion_prompt = f"{strategy['tone']} {strategy['approach']}"
                
                # 문서가 있는 경우 RAG 처리
                if documents and len(documents) > 0:
                    print(f"📄 문서 처리 시작: {len(documents)}개 문서")
                    
                    try:
                        # 첫 번째 문서로 RAG 쿼리 실행
                        document_id = documents[0].get('document_id')
                        if document_id:
                            print(f"🔍 RAG 쿼리 실행: document_id={document_id}")
                            
                            # RAG API 호출
                            rag_data = {
                                'query': user_message,
                                'user_id': user.username if user else 'default_user',
                                'document_id': document_id,
                                'max_length': max_length,
                                'temperature': 0.7
                            }
                            
                            print(f"📤 RAG 요청 데이터: {rag_data}")
                            response = requests.post(f"{lily_api_url}/rag/generate", data=rag_data, timeout=1200)
                            
                            if response.status_code == 200:
                                result = response.json()
                                print(f"✅ RAG API 응답 성공: {result.get('response', '')[:100]}...")
                                return {
                                    "response": result.get('response', ''),
                                    "provider": "lily",
                                    "ai_name": "Lily LLM (RAG)",
                                    "ai_type": "local"
                                }
                            else:
                                print(f"❌ RAG API 오류: {response.status_code} - {response.text}")
                                raise Exception(f"RAG API 오류: {response.status_code}")
                        else:
                            print("❌ 문서 ID가 없음")
                            raise Exception("문서 ID가 없습니다")
                            
                    except Exception as e:
                        print(f"❌ RAG API 호출 중 오류: {e}")
                        raise e
                
                # 이미지가 있는 경우 멀티모달 처리
                elif image_urls and len(image_urls) > 0:
                    print(f"🖼️ 다중 이미지 처리 시작: {len(image_urls)}개 이미지")
                    
                    # 이미지 파일들을 HTTP로 가져와서 바이트로 변환
                    image_data_list = []
                    for i, image_url in enumerate(image_urls):
                        try:
                            # 상대 URL을 절대 URL로 변환
                            if image_url.startswith('/media/'):
                                # Django 서버의 절대 URL로 변환
                                from django.conf import settings
                                base_url = getattr(settings, 'BASE_URL', 'http://localhost:8000')
                                absolute_url = f"{base_url}{image_url}"
                            else:
                                absolute_url = image_url
                            
                            print(f"🌐 이미지 URL {i+1}: {absolute_url}")
                            
                            # HTTP 요청으로 이미지 가져오기
                            image_response = requests.get(absolute_url, timeout=1200)
                            if image_response.status_code == 200:
                                image_bytes = image_response.content
                                print(f"✅ 이미지 {i+1} 다운로드 성공: {len(image_bytes)} bytes")
                                image_data_list.append(image_bytes)
                            else:
                                print(f"❌ 이미지 {i+1} 다운로드 실패: {image_response.status_code}")
                        except Exception as e:
                            print(f"❌ 이미지 {i+1} 읽기 오류: {e}")
                        except Exception as e:
                            print(f"❌ 이미지 {i+1} 읽기 오류: {e}")
                    
                    if image_data_list:
                        print(f"🔄 멀티모달 요청 준비 완료 ({len(image_data_list)}개 이미지 포함)")
                        
                        # Lily LLM API 호출
                        try:
                            print(f"🚀 Lily API 호출 시작: {lily_api_url}/generate")
                            
                            # Form data 구성
                            data = {
                                'prompt': f"{emotion_prompt}\n\n사용자 메시지: {user_message}",
                                'max_length': max_length,
                                'temperature': 0.7
                            }
                            
                            # 파일 데이터 구성
                            files = {}
                            for i, image_bytes in enumerate(image_data_list):
                                files[f'image{i+1}'] = (f'image{i+1}.png', image_bytes, 'image/png')
                            
                            print(f"📤 요청 데이터: {data}")
                            print(f"📁 파일 포함 여부: {bool(files)}")
                            
                            # API 호출
                            print(f"🔄 멀티모달 요청 전송 (이미지 포함)")
                            response = requests.post(f"{lily_api_url}/generate", data=data, files=files, timeout=1200)
                            
                            if response.status_code == 200:
                                result = response.json()
                                print(f"✅ Lily API 응답 성공: {result.get('generated_text', '')[:100]}...")
                                return {
                                    "response": result.get('generated_text', ''),
                                    "provider": "lily",
                                    "ai_name": "Lily LLM",
                                    "ai_type": "local"
                                }
                            else:
                                print(f"❌ Lily API 오류: {response.status_code} - {response.text}")
                                raise Exception(f"Lily API 오류: {response.status_code}")
                                
                        except Exception as e:
                            print(f"❌ Lily API 호출 중 오류: {e}")
                            raise e
                    else:
                        print("❌ 처리할 이미지가 없음")
                        raise Exception("이미지 처리 실패")
                else:
                    # 텍스트만 있는 경우
                    print("📝 텍스트 전용 요청")
                    
                    try:
                        # Form data 구성
                        data = {
                            'prompt': f"{emotion_prompt}\n\n사용자 메시지: {user_message}",
                            'max_length': max_length,
                            'temperature': 0.7
                        }
                        
                        print(f"📤 요청 데이터: {data}")
                        print(f"📁 파일 포함 여부: False")
                        
                        # API 호출
                        print(f"🔄 텍스트 전용 요청 전송")
                        response = requests.post(f"{lily_api_url}/generate", data=data, timeout=1200)
                        
                        if response.status_code == 200:
                            result = response.json()
                            print(f"✅ Lily API 응답 성공: {result.get('generated_text', '')[:100]}...")
                            return {
                                "response": result.get('generated_text', ''),
                                "provider": "lily",
                                "ai_name": "Lily LLM",
                                "ai_type": "local"
                            }
                        else:
                            print(f"❌ Lily API 오류: {response.status_code} - {response.text}")
                            raise Exception(f"Lily API 오류: {response.status_code}")
                            
                    except Exception as e:
                        print(f"❌ Lily API 호출 중 오류: {e}")
                        raise e
                        
            except Exception as e:
                print(f"❌ Lily API 호출 중 오류: {e}")
                raise e

        @sync_to_async
        def call_gemini(user_message, user_emotion, image_urls=None, documents=None, gemini_model='gemini-1.5-flash'):            
            # 감정 변화 추세 분석
            emotion_trend = self.get_emotion_trend()
            
            # 감정 전략 등 기존 코드 유지
            emotion_strategies = {
                "happy": {"tone": "기쁨과 함께 공감하며", "approach": "사용자의 기쁨을 함께 나누고, 긍정적인 에너지를 더해주세요. 기쁜 일에 대해 더 자세히 이야기해보도록 유도하세요.", "examples": "정말 기뻐 보이네요! 😊 어떤 일이 그렇게 기쁘게 만든 거예요? 함께 기뻐해도 될까요?"},
                "sad": {"tone": "따뜻하고 공감적으로", "approach": "사용자의 슬픔에 공감하고, 위로와 격려를 제공하세요. 슬픈 감정을 인정하고, 함께 극복할 방법을 찾아보세요.", "examples": "지금 많이 힘드시겠어요. 😔 그런 감정을 느끼는 것은 당연해요. 제가 옆에서 함께 있어드릴게요."},
                "angry": {"tone": "차분하고 이해하며", "approach": "사용자의 분노를 인정하고, 차분하게 상황을 분석해보세요. 분노의 원인을 찾고 해결책을 제시하세요.", "examples": "화가 나시는 것 같아요. 😤 어떤 일이 그렇게 화나게 만든 거예요? 함께 해결책을 찾아보시죠."},
                "surprised": {"tone": "놀라움을 함께하며", "approach": "사용자의 놀라움에 공감하고, 그 상황에 대해 더 자세히 알아보세요. 새로운 관점을 제시하세요.", "examples": "정말 놀라운 일이었나 보네요! 😮 어떤 일이 그렇게 놀라게 만든 거예요? 더 자세히 들려주세요."},
                "fearful": {"tone": "안심시키며", "approach": "사용자의 두려움을 인정하고, 안심시켜주세요. 구체적인 해결책과 지원을 제시하세요.", "examples": "걱정되시는 것 같아요. 😰 어떤 일이 그렇게 걱정되게 만든 거예요? 함께 해결해보시죠."},
                "disgusted": {"tone": "이해하며", "approach": "사용자의 혐오감을 인정하고, 그 상황에 대해 객관적으로 분석해보세요.", "examples": "정말 싫은 일이었나 보네요. 🤢 어떤 일이 그렇게 싫게 만든 거예요? 다른 관점에서 보면 어떨까요?"},
                "neutral": {"tone": "편안하고 친근하게", "approach": "자연스럽고 편안한 대화를 이어가세요. 사용자의 관심사에 집중하고 유용한 정보를 제공하세요.", "examples": "편안한 대화를 나누고 싶으시군요. 😊 어떤 이야기를 나누고 싶으신가요?"}
            }
            
            # 현재 감정에 따른 전략 선택
            current_emotion = user_emotion.lower()
            strategy = emotion_strategies.get(current_emotion, emotion_strategies["neutral"])
            
            # 감정 변화 추세에 따른 추가 전략
            if emotion_trend == "improving":
                strategy["approach"] += " 긍정적인 변화가 보이시네요. 계속해서 좋은 방향으로 나아가고 계세요."
            elif emotion_trend == "declining":
                strategy["approach"] += " 요즘 힘드신 것 같아요. 제가 더 많이 도와드릴게요."
            
            # 프롬프트 구성
            emotion_prompt = f"{strategy['tone']} {strategy['approach']}"
            
            # 문서가 있는 경우 (Gemini는 문서 처리 제한적)
            if documents and len(documents) > 0:
                print(f"📄 문서 처리 (Gemini): {len(documents)}개 문서")
                # Gemini는 문서 처리에 제한이 있으므로 기본 응답
                return {
                    "response": f"{emotion_prompt}\n\n문서를 첨부해주셨네요. 현재 Gemini는 문서 분석에 제한이 있습니다. Lily LLM을 사용하시면 더 정확한 문서 분석이 가능합니다.",
                    "provider": "gemini",
                    "ai_name": "Gemini",
                    "ai_type": "google"
                }
            
            # 이미지가 있는 경우 멀티모달 처리
            elif image_urls and len(image_urls) > 0:
                print(f"🖼️ 이미지 처리 (Gemini): {len(image_urls)}개 이미지")
                
                # Gemini는 첫 번째 이미지만 처리
                first_image_url = image_urls[0]
                
                try:
                    # Gemini API 직접 호출
                    import requests
                    import base64
                    
                    # 이미지 파일 읽기 (HTTP로 가져오기)
                    if first_image_url.startswith('/media/'):
                        # Django 서버의 절대 URL로 변환
                        from django.conf import settings
                        base_url = getattr(settings, 'BASE_URL', 'http://localhost:8000')
                        absolute_url = f"{base_url}{first_image_url}"
                    else:
                        absolute_url = first_image_url
                    
                    image_response = requests.get(absolute_url, timeout=1200)
                    if image_response.status_code != 200:
                        raise Exception(f"이미지 다운로드 실패: {image_response.status_code}")
                    
                    image_bytes = image_response.content
                    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                    
                    # Gemini API 호출
                    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent"
                    headers = {
                        "Content-Type": "application/json",
                        "x-goog-api-key": os.getenv('GEMINI_API_KEY')
                    }
                        
                    payload = {
                        "contents": [{
                            "parts": [
                                {
                                    "text": f"{emotion_prompt}\n\n사용자 메시지: {user_message}"
                                },
                                        {
                                            "inline_data": {
                                                "mime_type": "image/png",
                                        "data": image_base64
                                    }
                                }
                            ]
                        }],
                        "generationConfig": {
                            "maxOutputTokens": 512,
                            "temperature": 0.7
                        }
                    }
                    
                    # Gemini API 호출
                    response = requests.post(gemini_url, headers=headers, json=payload, timeout=60)
                    
                    if response.status_code == 200:
                        result = response.json()
                        if 'candidates' in result and len(result['candidates']) > 0:
                            gemini_response = result['candidates'][0]['content']['parts'][0]['text']
                            return {
                                "response": gemini_response,
                                "provider": "gemini",
                                "ai_name": "Gemini",
                                "ai_type": "google"
                            }
                        else:
                            raise Exception("Gemini API 응답 형식 오류")
                    else:
                        raise Exception(f"Gemini API 오류: {response.status_code} - {response.text}")
                        
                except Exception as e:
                    print(f"❌ Gemini API 호출 중 오류: {e}")
                    raise e
            else:
                # 텍스트만 있는 경우
                print("📝 텍스트 전용 요청 (Gemini)")
                
                try:
                    # Gemini API 직접 호출
                    import requests
                    
                    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent"
                    headers = {
                        "Content-Type": "application/json",
                        "x-goog-api-key": os.getenv('GEMINI_API_KEY')
                    }
                    
                    payload = {
                        "contents": [{
                            "parts": [
                                {
                                    "text": f"{emotion_prompt}\n\n사용자 메시지: {user_message}"
                                }
                            ]
                        }],
                        "generationConfig": {
                            "maxOutputTokens": 512,
                            "temperature": 0.7
                        }
                    }
                    
                    # Gemini API 호출
                    response = requests.post(gemini_url, headers=headers, json=payload, timeout=60)
                    
                    if response.status_code == 200:
                        result = response.json()
                        if 'candidates' in result and len(result['candidates']) > 0:
                            gemini_response = result['candidates'][0]['content']['parts'][0]['text']
                            return {
                                "response": gemini_response,
                                "provider": "gemini",
                                "ai_name": "Gemini",
                                "ai_type": "google"
                            }
                        else:
                            raise Exception("Gemini API 응답 형식 오류")
                    else:
                        raise Exception(f"Gemini API 오류: {response.status_code} - {response.text}")
                    
                except Exception as e:
                    print(f"❌ Gemini API 호출 중 오류: {e}")
                    raise e

        @sync_to_async
        def call_huggingface_space(user_message, user_emotion, image_urls=None, documents=None):
            """Hugging Face 스페이스 API 호출"""
            import requests
            import json
            
            try:
                # 허깅페이스 스페이스 URL
                hf_space_url = "https://gbrabbit-lily-math-rag.hf.space"
                
                # 감정 변화 추세 분석
                emotion_trend = self.get_emotion_trend()
                
                # 감정 전략
                emotion_strategies = {
                    "happy": {"tone": "기쁨과 함께 공감하며", "approach": "사용자의 기쁨을 함께 나누고, 긍정적인 에너지를 더해주세요."},
                    "sad": {"tone": "따뜻하고 공감적으로", "approach": "사용자의 슬픔에 공감하고, 위로와 격려를 제공하세요."},
                    "angry": {"tone": "차분하고 이해하며", "approach": "사용자의 분노를 인정하고, 차분하게 상황을 분석해보세요."},
                    "surprised": {"tone": "놀라움을 함께하며", "approach": "사용자의 놀라움에 공감하고, 그 상황에 대해 더 자세히 알아보세요."},
                    "fearful": {"tone": "안심시키며", "approach": "사용자의 두려움을 인정하고, 안심시켜주세요."},
                    "disgusted": {"tone": "이해하며", "approach": "사용자의 혐오감을 인정하고, 그 상황에 대해 객관적으로 분석해보세요."},
                    "neutral": {"tone": "편안하고 친근하게", "approach": "자연스럽고 편안한 대화를 이어가세요."}
                }
                
                # 현재 감정에 따른 전략 선택
                current_emotion = user_emotion.lower()
                strategy = emotion_strategies.get(current_emotion, emotion_strategies["neutral"])
                
                # 감정 변화 추세에 따른 추가 전략
                if emotion_trend == "improving":
                    strategy["approach"] += " 긍정적인 변화가 보이시네요. 계속해서 좋은 방향으로 나아가고 계세요."
                elif emotion_trend == "declining":
                    strategy["approach"] += " 요즘 힘드신 것 같아요. 제가 더 많이 도와드릴게요."
                
                # 프롬프트 구성
                emotion_prompt = f"{strategy['tone']} {strategy['approach']}"
                
                # 허깅페이스 스페이스 API 호출
                api_data = {
                    "data": [
                        f"{emotion_prompt}\n\n사용자 메시지: {user_message}",
                        "kanana-1.5-v-3b-instruct",  # 모델명
                        512,  # max_new_tokens
                        0.7,  # temperature
                        0.9,  # top_p
                        1.0,  # repetition_penalty
                        True   # do_sample
                    ]
                }
                
                print(f"🌐 Hugging Face 스페이스 API 호출: {hf_space_url}")
                print(f"📤 요청 데이터: {api_data}")
                
                response = requests.post(
                    f"{hf_space_url}/api/predict",
                    json=api_data,
                    headers={"Content-Type": "application/json"},
                    timeout=120
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"✅ Hugging Face 스페이스 API 응답 성공")
                    
                    # Gradio API 응답 형식에서 텍스트 추출
                    if 'data' in result and len(result['data']) > 0:
                        hf_response = result['data'][0]
                        return {
                            "response": hf_response,
                            "provider": "huggingface",
                            "ai_name": "Kanana LLM (Hugging Face)",
                            "ai_type": "huggingface"
                        }
                    else:
                        raise Exception("Hugging Face API 응답 형식 오류")
                else:
                    raise Exception(f"Hugging Face API 오류: {response.status_code} - {response.text}")
                    
            except Exception as e:
                print(f"❌ Hugging Face 스페이스 API 호출 중 오류: {e}")
                raise e

        # 사용자의 AI 설정에 따라 적절한 API 호출
        user = getattr(self, 'scope', {}).get('user', None)
        ai_settings = None
        if user and hasattr(user, 'is_authenticated') and user.is_authenticated:
            ai_settings = await self.get_user_ai_settings(user)
            print(f"🔍 사용자 AI 설정(DB): {ai_settings}")
        else:
            print(f"🔍 사용자 인증되지 않음 (DB 설정을 사용할 수 없음)")

        # 클라이언트에서 넘어온 설정이 있으면 DB 설정보다 우선 적용
        if client_ai_settings:
            print(f"🔧 클라이언트 AI 설정 적용: {client_ai_settings}")
            if not ai_settings:
                ai_settings = {}
            # 안전 병합 (클라이언트 값이 우선)
            for key, value in client_ai_settings.items():
                if value not in (None, ""):
                    ai_settings[key] = value
            print(f"🔧 병합 후 최종 AI 설정: {ai_settings}")
        
        ai_provider = ai_settings.get('aiProvider', 'gemini') if ai_settings else 'gemini'
        gemini_model = ai_settings.get('geminiModel', 'gemini-1.5-flash') if ai_settings else 'gemini-1.5-flash'
        print(f"🔍 최종 결정된 제공자: {ai_provider}")
        
        print(f"🔍 AI 제공자: {ai_provider}")
        print(f"🔍 Gemini 모델: {gemini_model}")
        
        try:
            if ai_provider == 'lily':
                print("🚀 Lily LLM API 호출")
                result = await call_lily_api(user_message, user_emotion, image_urls, documents)
                return {
                    'response': result.get('response', ''),
                    'provider': result.get('provider', 'lily'),
                    'ai_name': result.get('ai_name', 'Lily LLM'),
                    'ai_type': result.get('ai_type', 'local')
                }
            elif ai_provider == 'huggingface':
                print("🚀 Hugging Face 스페이스 API 호출")
                result = await call_huggingface_space(user_message, user_emotion, image_urls, documents)
                return {
                    'response': result.get('response', ''),
                    'provider': result.get('provider', 'huggingface'),
                    'ai_name': result.get('ai_name', 'Kanana LLM (Hugging Face)'),
                    'ai_type': result.get('ai_type', 'huggingface')
                }
            else:
                print("🚀 Gemini API 호출")
                result = await call_gemini(user_message, user_emotion, image_urls, documents, gemini_model)
                return {
                    'response': result.get('response', ''),
                    'provider': result.get('provider', 'gemini'),
                    'ai_name': result.get('ai_name', 'Gemini'),
                    'ai_type': result.get('ai_type', 'google')
                }
        except Exception as e:
            print(f"❌ {ai_provider} API 호출 실패: {e}")
            # 실패 시 사용자에게 명확한 메시지 제공
            if ai_provider == 'lily':
                error_message = f"Lily LLM 서버에 연결할 수 없습니다. (오류: {str(e)[:100]})\n\n허깅페이스 스페이스 상태를 확인해주세요: https://huggingface.co/spaces/gbrabbit/lily_fast_api\n\nGemini로 전환하시겠습니까?"
                return {
                    'response': error_message,
                    'provider': 'error',
                    'ai_name': 'Lily LLM (연결 실패)',
                    'ai_type': 'error'
                }
            elif ai_provider == 'huggingface':
                error_message = f"Hugging Face 스페이스에 연결할 수 없습니다. (오류: {str(e)[:100]})\n\nGemini로 전환하시겠습니까?"
                return {
                    'response': error_message,
                    'provider': 'error',
                    'ai_name': 'Hugging Face (연결 실패)',
                    'ai_type': 'error'
                }
            else:
                # Gemini도 실패한 경우
                error_message = f"AI 서비스에 연결할 수 없습니다. (오류: {str(e)[:100]})"
                return {
                    'response': error_message,
                    'provider': 'error',
                    'ai_name': 'AI 서비스 (연결 실패)',
                    'ai_type': 'error'
                }

