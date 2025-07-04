import json
import os
from channels.generic.websocket import AsyncWebsocketConsumer
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv() # .env 파일 불러오기 (API 키 보안)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass
    
    async def receive(self, text_data):
        print("WebSocket 메시지 수신:", text_data)  # 로그 확인용

        # 1. 빈 메시지 예외처리
        if not text_data:
            await self.send(text_data=json.dumps({
                'message': "빈 메시지는 처리할 수 없습니다."
            }))
            return

        # 2. JSON 파싱 예외처리
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'message': "잘못된 형식의 메시지입니다. JSON 형식으로 보내주세요."
            }))
            return

        # 3. message 키 유무 확인
        user_message = data.get("message")
        if user_message is None:
            await self.send(text_data=json.dumps({
                'message': "메시지에 'message' 키가 없습니다."
            }))
            return

        # 4. AI 응답 처리
        try:
            ai_response = await self.get_ai_response(user_message)
            await self.send(text_data=json.dumps({
                'message': ai_response
            }))
        except Exception as e:
            print("WebSocket 처리 중 오류 발생:", e)
            await self.send(text_data=json.dumps({
                'message': f"AI 오류: {str(e)}"
            }))


    async def get_ai_response(self, user_message):
        # 비동기 처리용 sync_to_async 사용 필요
        from asgiref.sync import sync_to_async

        @sync_to_async
        def call_openai():
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "당신은 따뜻하고 친근한 AI 대화상대입니다."},
                    {"role": "user", "content": user_message}
                ]
            )
            return response.choices[0].message.content

        return await call_openai()

