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
        if user_message is None:
            await self.send(text_data=json.dumps({'message': "메시지에 'message' 키가 없습니다."}))
            return

        # 사용자 메시지를 DB에 저장
        print(f"사용자 메시지 저장 시도: {user_message}")
        await self.save_user_message(user_message)

        try:
            ai_response = await self.get_ai_response(user_message)
            print(f"AI 응답 받음: {ai_response}")
            # AI 응답을 DB에 저장
            print(f"AI 응답 저장 시도: {ai_response}")
            await self.save_ai_message(ai_response)
            await self.send(text_data=json.dumps({'message': ai_response}))
        except Exception as e:
            print("WebSocket 처리 중 오류 발생:", e)
            error_message = f"AI 오류: {str(e)}"
            await self.save_ai_message(error_message)
            await self.send(text_data=json.dumps({'message': error_message}))

    @sync_to_async
    def save_user_message(self, content):
        """사용자 메시지를 DB에 저장"""
        try:
            from .models import Chat
            result = Chat.save_user_message(content, self.session_id)
            print(f"사용자 메시지 저장 성공: {result.id}")
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

    async def get_ai_response(self, user_message):
        from asgiref.sync import sync_to_async

        @sync_to_async
        def call_gemini():
            client = OpenAI(
                api_key=os.environ.get("GEMINI_API_KEY"),
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
            )
            response = client.chat.completions.create(
                model="gemini-2.5-flash",
                messages=[
                    {"role": "system", "content": "당신은 따뜻하고 친근한 AI 대화상대입니다."},
                    {"role": "user", "content": user_message}
                ]
            )
            return response.choices[0].message.content

        return await call_gemini()
