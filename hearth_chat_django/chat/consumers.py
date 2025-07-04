import json
import os
from channels.generic.websocket import AsyncWebsocketConsumer
from dotenv import load_dotenv

load_dotenv()
from openai import OpenAI

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

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

        try:
            ai_response = await self.get_ai_response(user_message)
            await self.send(text_data=json.dumps({'message': ai_response}))
        except Exception as e:
            print("WebSocket 처리 중 오류 발생:", e)
            await self.send(text_data=json.dumps({'message': f"AI 오류: {str(e)}"}))

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
