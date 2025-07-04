import websocket
import json

def on_message(ws, message):
    print("Received:", message)

def on_open(ws):
    ws.send(json.dumps({"message": "안녕, 헬로우!"}))

ws = websocket.WebSocketApp("ws://localhost:8000/ws/chat/",
                            on_message=on_message)
ws.on_open = on_open
ws.run_forever()
