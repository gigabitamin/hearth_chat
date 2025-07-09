#!/bin/bash

echo "🚀 Docker 빌드 최적화 시작..."

# 1. 불필요한 파일 정리
echo "📁 불필요한 파일 정리 중..."
find . -name "*.pyc" -delete
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true

# 2. Docker 빌드 (캐시 사용)
echo "🐳 Docker 이미지 빌드 중..."
docker build --no-cache -t hearth-chat:latest .

# 3. 이미지 크기 확인
echo "📊 이미지 크기 확인..."
docker images hearth-chat:latest

echo "✅ 빌드 완료!" 