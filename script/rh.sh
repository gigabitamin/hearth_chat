#!/bin/bash

# 1. Daphne 서버 실행 (dh.bat)
echo "Hearth_chat Daphne Start"
cd /app/hearth_chat_django
export DJANGO_SETTINGS_MODULE=hearth_chat.settings
daphne -b 0.0.0.0 -p 8000 hearth_chat.asgi:application

# 2. Git push hearth chat kdy (gkhc.bat)
# echo "git push hearth chat kdy"
# cd /app
# git add .
# git commit -m "Auto commit at $(date '+%Y-%m-%d %H:%M:%S')"
# git push origin kdy

# 3. Git push hearth chat main (gmhc.bat)
# echo "git push hearth chat main"
# cd /app
# git add .
# git commit -m "Auto commit at $(date '+%Y-%m-%d %H:%M:%S')"
# git push origin main

# 5. React 개발 서버 실행 (rh.bat)
# echo "Hearth_chat React Start"
# cd /app/hearth_chat_react
# npm start

# 6. cdhr.bat, cdhd.bat (디렉토리 이동)
# cd /app/hearth_chat_react
# cd /app/hearth_chat_django

# 7. 가상환경 활성화 (vh.bat)
# echo "Activating hearth_chat virtual environment..."
# source /app/hearth_chat_django/venv/bin/activate