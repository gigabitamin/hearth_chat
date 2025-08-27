# 1️⃣ 앱 생성 (도쿄 nrt, DB는 나중에 따로)
fly launch --region nrt --no-deploy

# 2️⃣ Managed Postgres 생성 (시드니 syd)
fly postgres create --name hearth-db --region syd \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 10

# 3️⃣ 앱과 DB 연결
fly postgres attach hearth-db

# 4️⃣ Django DB 설정을 환경변수 기반으로 변경 (settings.py 수정)
# 아래 파이썬 코드 참고:
# ---------------------------------------
# import dj_database_url
# import os
#
# DATABASES = {
#     'default': dj_database_url.config(default=os.environ.get('DATABASE_URL'))
# }
# ---------------------------------------

# 5️⃣ 앱 배포
fly deploy

# 6️⃣ 앱 지역 우선순위 설정 (도쿄 우선, 시드니 예비)
fly regions set nrt syd
