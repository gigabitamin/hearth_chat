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

    async def connect(self):
        await self.accept()
        # 세션 ID 생성
        self.session_id = str(uuid.uuid4())
        print(f"새로운 WebSocket 연결: {self.session_id}")

    async def disconnect(self, close_code):
        print(f"WebSocket 연결 종료: {self.session_id}")

    async def receive(self, text_data):
        print("WebSocket 메시지 수신:", text_data)
        if not text_data:
            await self.send(text_data=json.dumps({'message': "빈 메시지는 처리할 수 없습니다."}))
            return
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({'message': "잘못된 형식의 메시지입니다. JSON 형식으로 보내주세요."}))
            return
        
        user_message = data.get("message")
        user_emotion = data.get("emotion", "neutral")  # 감정 정보 추출
        
        if user_message is None:
            await self.send(text_data=json.dumps({'message': "메시지에 'message' 키가 없습니다."}))
            return

        # 감정 변화 추적
        self.update_emotion_history(user_emotion)
        
        # 사용자 메시지를 DB에 저장 (감정 정보 포함)
        print(f"사용자 메시지 저장 시도: {user_message} (감정: {user_emotion})")
        await self.save_user_message(user_message, user_emotion)

        try:
            ai_response = await self.get_ai_response(user_message, user_emotion)
            print(f"AI 응답 받음: {ai_response}")
            
            # AI 응답을 DB에 저장
            print(f"AI 응답 저장 시도: {ai_response}")
            await self.save_ai_message(ai_response)
            
            # 대화 컨텍스트 업데이트
            self.conversation_context.append({
                "user": {"message": user_message, "emotion": user_emotion},
                "ai": {"message": ai_response}
            })
            
            # 컨텍스트가 너무 길어지면 최근 10개만 유지
            if len(self.conversation_context) > 10:
                self.conversation_context = self.conversation_context[-10:]
            
            await self.send(text_data=json.dumps({'message': ai_response}))
        except Exception as e:
            print("WebSocket 처리 중 오류 발생:", e)
            error_message = f"AI 오류: {str(e)}"
            await self.save_ai_message(error_message)
            await self.send(text_data=json.dumps({'message': error_message}))

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
    def save_user_message(self, content, emotion="neutral"):
        """사용자 메시지를 DB에 저장 (감정 정보 포함)"""
        try:
            from .models import Chat
            result = Chat.save_user_message(content, self.session_id, emotion)
            print(f"사용자 메시지 저장 성공: {result.id} (감정: {emotion})")
            return result
        except Exception as e:
            print(f"사용자 메시지 저장 실패: {e}")
            raise e

    @sync_to_async
    def save_ai_message(self, content):
        """AI 메시지를 DB에 저장"""
        try:
            from .models import Chat
            result = Chat.save_ai_message(content, self.session_id)
            print(f"AI 메시지 저장 성공: {result.id}")
            return result
        except Exception as e:
            print(f"AI 메시지 저장 실패: {e}")
            raise e

    async def get_ai_response(self, user_message, user_emotion="neutral"):
        from asgiref.sync import sync_to_async

        @sync_to_async
        def call_gemini():
            # 감정 변화 추세 분석
            emotion_trend = self.get_emotion_trend()
            
            # 감정에 따른 상세한 응답 전략
            emotion_strategies = {
                "happy": {
                    "tone": "기쁨과 함께 공감하며",
                    "approach": "사용자의 기쁨을 함께 나누고, 긍정적인 에너지를 더해주세요. 기쁜 일에 대해 더 자세히 이야기해보도록 유도하세요.",
                    "examples": "정말 기뻐 보이네요! 😊 어떤 일이 그렇게 기쁘게 만든 거예요? 함께 기뻐해도 될까요?"
                },
                "sad": {
                    "tone": "따뜻하고 공감적으로",
                    "approach": "사용자의 슬픔에 공감하고, 위로와 격려를 제공하세요. 슬픈 감정을 인정하고, 함께 극복할 방법을 찾아보세요.",
                    "examples": "지금 많이 힘드시겠어요. 😔 그런 감정을 느끼는 것은 당연해요. 제가 옆에서 함께 있어드릴게요."
                },
                "angry": {
                    "tone": "차분하고 이해하는 태도로",
                    "approach": "사용자의 분노를 인정하고, 차분하게 상황을 분석해보세요. 분노의 원인을 파악하고 해결책을 제시하세요.",
                    "examples": "화가 나실 만해요. 😤 그런 상황이라면 누구라도 화가 날 거예요. 차분히 생각해보면 어떨까요?"
                },
                "fearful": {
                    "tone": "안심시키고 안전함을 느끼게",
                    "approach": "사용자의 두려움을 인정하고, 안전함을 느끼게 해주세요. 구체적인 해결책이나 대안을 제시하세요.",
                    "examples": "무서우시겠어요. 😰 걱정하지 마세요, 함께 해결해보아요. 어떤 부분이 가장 두려우신가요?"
                },
                "surprised": {
                    "tone": "함께 놀라워하며",
                    "approach": "사용자의 놀라움에 함께 반응하고, 호기심을 나누어주세요. 놀라운 일에 대해 더 자세히 알아보세요.",
                    "examples": "정말 놀라운 일이네요! 😲 저도 함께 놀랐어요. 어떻게 된 일인지 더 자세히 들려주세요!"
                },
                "disgusted": {
                    "tone": "이해하고 다른 주제로 전환",
                    "approach": "사용자의 불쾌감을 인정하고, 다른 주제로 자연스럽게 전환하세요. 긍정적인 주제로 대화를 이어가세요.",
                    "examples": "그런 일이 있으셨군요. 😕 다른 이야기로 기분 전환해볼까요? 요즘 즐거운 일은 없으셨나요?"
                },
                "neutral": {
                    "tone": "편안하고 자연스럽게",
                    "approach": "평온한 상태를 유지하며, 자연스럽고 편안한 대화를 이어가세요. 관심사나 일상에 대해 이야기해보세요.",
                    "examples": "편안한 하루 보내고 계시네요. 😊 오늘은 어떤 일이 있었나요? 이야기해주세요."
                }
            }
            
            strategy = emotion_strategies.get(user_emotion, emotion_strategies["neutral"])
            
            # 감정 변화에 따른 추가 지침
            trend_guidance = {
                "improving": "사용자의 기분이 좋아지고 있는 것 같아요. 이 긍정적인 흐름을 유지할 수 있도록 도와주세요.",
                "declining": "사용자의 기분이 안 좋아지고 있는 것 같아요. 더 따뜻하고 지지적인 태도로 접근해주세요.",
                "stable": "사용자의 감정 상태가 안정적입니다. 편안하고 일관된 톤으로 대화를 이어가주세요."
            }
            
            trend_guide = trend_guidance.get(emotion_trend, trend_guidance["stable"])
            
            # 대화 컨텍스트 분석
            context_summary = ""
            if len(self.conversation_context) > 0:
                recent_context = self.conversation_context[-3:]  # 최근 3개 대화
                context_summary = "최근 대화 맥락: " + " | ".join([
                    f"사용자({ctx['user']['emotion']}): {ctx['user']['message'][:50]}..."
                    for ctx in recent_context
                ])
            
            system_content = f"""당신은 따뜻하고 공감적인 AI 대화상대입니다. 
            벽난로 주변의 아늑한 공간에서 대화하는 것처럼 편안하고 따뜻한 톤으로 응답해주세요.
            
            현재 사용자의 감정 상태: {user_emotion}
            감정 변화 추세: {emotion_trend}
            
            응답 전략:
            - 톤: {strategy['tone']}
            - 접근법: {strategy['approach']}
            - 감정 변화 지침: {trend_guide}
            
            {context_summary}
            
            사용자의 감정에 맞춰 적절한 톤과 내용으로 응답해주세요. 
            필요시 조언, 위로, 격려, 동조, 기쁨 등을 자연스럽게 표현하세요.
            이모티콘을 적절히 사용하여 감정을 표현하세요."""
            
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

        return await call_gemini()
