from django.views.generic import View
from django.http import HttpResponse
import os

class ReactAppView(View):
    def get(self, request):
        try:
            react_index_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "../hearth_chat_react/build/index.html"
            )
            with open(react_index_path, encoding="utf-8") as f:
                return HttpResponse(f.read())
        except FileNotFoundError:
            return HttpResponse(
                "React build 파일이 없습니다. 프론트엔드 빌드 후 다시 시도하세요.",
                status=501,
            ) 