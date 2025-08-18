#!/bin/bash

# CI 환경에서 React 앱을 빌드하는 스크립트
# ESLint 경고를 에러로 처리하지 않음

echo "🔨 CI 환경 React 빌드 시작"
echo "=========================="

# CI 환경 변수 설정
export CI=false
export GENERATE_SOURCEMAP=false

# 의존성 설치 확인
if [ ! -d "node_modules" ]; then
    echo "📦 node_modules가 없습니다. 의존성을 설치합니다..."
    npm ci
fi

# 빌드 실행
echo "🚀 React 앱 빌드 중..."
npm run build

# 빌드 결과 확인
if [ -d "build" ]; then
    echo "✅ 빌드 성공!"
    echo "📁 빌드 폴더 크기: $(du -sh build | cut -f1)"
    echo "📄 빌드된 파일들:"
    ls -la build/
else
    echo "❌ 빌드 실패!"
    exit 1
fi 