import requests

API_KEY = "AIzaSyA8W0B5dsSKhTWKb-VcVjantISwQMnRc0M"

# 1. 사용 가능한 모델 목록 확인
print("=== 사용 가능한 모델 목록 확인 ===")
models_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}"

try:
    print("모델 목록 요청 시작")
    models_response = requests.get(models_url, timeout=10)
    print("모델 목록 요청 완료")
    print("Status Code:", models_response.status_code)
    print("Response:", models_response.text)
except Exception as e:
    print("모델 목록 요청 에러:", e)

print("\n" + "="*50 + "\n")

# 2. 여러 모델로 API 호출 시도 (무료 쿼터가 남은 모델들)
print("=== 여러 모델로 Gemini API 호출 테스트 ===")

models_to_test = [
    "gemini-1.5-flash",      # 빠른 모델
    "gemini-1.5-flash-8b",   # 가벼운 모델
    "gemini-1.5-flash-002",  # 안정 버전
    "gemini-2.0-flash",      # 최신 모델
    "gemini-2.0-flash-lite"  # 라이트 버전
]

headers = {
    "Content-Type": "application/json"
}
payload = {
    "contents": [
        {
            "parts": [
                {"text": "Hello, Gemini!"}
            ]
        }
    ]
}

for model in models_to_test:
    print(f"\n--- {model} 모델 테스트 ---")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}"
    
    try:
        print(f"{model} API 호출 시작")
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        print(f"{model} API 호출 완료")
        print("Status Code:", response.status_code)
        
        if response.status_code == 200:
            print("✅ 성공!")
            print("Response:", response.text[:200] + "..." if len(response.text) > 200 else response.text)
            break  # 성공하면 더 이상 테스트하지 않음
        else:
            print("❌ 실패")
            print("Response:", response.text)
            
    except Exception as e:
        print(f"❌ {model} 에러 발생:", e) 