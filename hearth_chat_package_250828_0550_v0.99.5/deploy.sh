#!/bin/bash

# 🚀 수동 배포 스크립트 (Render 무료 분량 절약)
# 사용법: ./deploy.sh [environment] [force_rebuild]

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 기본값 설정
ENVIRONMENT=${1:-production}
FORCE_REBUILD=${2:-false}

echo -e "${BLUE}🚀 Hearth Chat 수동 배포 시작${NC}"
echo -e "${YELLOW}환경: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}강제 재빌드: ${FORCE_REBUILD}${NC}"
echo ""

# 1. 코드 상태 확인
echo -e "${BLUE}📋 1. 코드 상태 확인 중...${NC}"
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}❌ 커밋되지 않은 변경사항이 있습니다.${NC}"
    git status --short
    echo ""
    echo -e "${YELLOW}💡 다음 중 하나를 선택하세요:${NC}"
    echo "   1. git add . && git commit -m '배포 전 커밋'"
    echo "   2. git stash"
    echo "   3. 변경사항을 되돌리기"
    exit 1
else
    echo -e "${GREEN}✅ 모든 변경사항이 커밋되었습니다.${NC}"
fi

# 2. 최신 커밋 정보
echo -e "${BLUE}📋 2. 최신 커밋 정보${NC}"
echo -e "${YELLOW}현재 브랜치: $(git branch --show-current)${NC}"
echo -e "${YELLOW}최신 커밋: $(git log -1 --oneline)${NC}"
echo -e "${YELLOW}커밋 해시: $(git rev-parse HEAD)${NC}"
echo ""

# 3. 테스트 실행 (선택사항)
read -p "🧪 테스트를 실행하시겠습니까? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}📋 3. 테스트 실행 중...${NC}"
    
    # Django 테스트
    echo -e "${YELLOW}Django 테스트 실행 중...${NC}"
    cd hearth_chat_django
    python manage.py test --verbosity=2
    cd ..
    
    # React 테스트 (package.json에 test 스크립트가 있는 경우)
    if [ -f "hearth_chat_react/package.json" ] && grep -q '"test"' hearth_chat_react/package.json; then
        echo -e "${YELLOW}React 테스트 실행 중...${NC}"
        cd hearth_chat_react
        npm test -- --watchAll=false
        cd ..
    fi
    
    echo -e "${GREEN}✅ 테스트 완료${NC}"
else
    echo -e "${YELLOW}⚠️ 테스트를 건너뜁니다.${NC}"
fi

echo ""

# 4. 빌드 확인
echo -e "${BLUE}📋 4. 빌드 상태 확인${NC}"
if [ -d "hearth_chat_react/build" ]; then
    echo -e "${GREEN}✅ React 빌드 폴더가 존재합니다.${NC}"
else
    echo -e "${YELLOW}⚠️ React 빌드 폴더가 없습니다. 빌드를 생성합니다.${NC}"
    cd hearth_chat_react
    npm run build
    cd ..
    echo -e "${GREEN}✅ React 빌드 완료${NC}"
fi

echo ""

# 5. 배포 안내
echo -e "${BLUE}📋 5. 배포 방법 안내${NC}"
echo -e "${GREEN}✅ 모든 준비가 완료되었습니다!${NC}"
echo ""
echo -e "${YELLOW}🚀 다음 중 하나의 방법으로 배포하세요:${NC}"
echo ""
echo -e "${BLUE}방법 1: GitHub Actions 수동 트리거${NC}"
echo "   1. GitHub 저장소 > Actions 탭"
echo "   2. 'Manual Deploy to Render' 워크플로우 선택"
echo "   3. 'Run workflow' 클릭"
echo "   4. Environment: ${ENVIRONMENT} 선택"
echo "   5. Force rebuild: ${FORCE_REBUILD} 선택"
echo ""
echo -e "${BLUE}방법 2: Render 대시보드 직접 배포${NC}"
echo "   1. https://dashboard.render.com 접속"
echo "   2. 해당 서비스 선택"
echo "   3. 'Manual Deploy' 클릭"
echo "   4. 'Deploy latest commit' 선택"
echo ""
echo -e "${YELLOW}💡 렌더 무료 분량을 절약하기 위해 자동 배포가 비활성화되었습니다.${NC}"
echo -e "${YELLOW}💡 수동으로 배포를 진행해주세요.${NC}"

# 6. 환경 변수 체크리스트
echo ""
echo -e "${BLUE}📋 6. 배포 전 체크리스트${NC}"
echo -e "${YELLOW}□ 환경 변수 설정 확인${NC}"
echo -e "${YELLOW}□ 데이터베이스 연결 확인${NC}"
echo -e "${YELLOW}□ 정적 파일 설정 확인${NC}"
echo -e "${YELLOW}□ 보안 설정 확인${NC}"
echo -e "${YELLOW}□ 백업 완료${NC}"

echo ""
echo -e "${GREEN}🎉 배포 준비 완료!${NC}" 