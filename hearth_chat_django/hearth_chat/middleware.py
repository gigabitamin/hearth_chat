from django.utils.deprecation import MiddlewareMixin
from django.conf import settings


class MobileCookieRelaxMiddleware(MiddlewareMixin):
    """Relax cookie attributes for mobile WebView origins (Capacitor/localhost).

    This preserves cookie values (including Django-signed session cookies)
    but adjusts attributes to allow cookies to be sent from non-https schemes.
    """

    def process_response(self, request, response):
        try:
            origin = request.headers.get('Origin', '') or request.headers.get('Referer', '') or ''
            is_mobile_webview = (
                origin.startswith('capacitor://') or
                origin.startswith('http://localhost') or
                origin.startswith('https://localhost')
            )
            if not is_mobile_webview:
                return response

            # Relax cookie attributes for CSRF and session cookies
            target_cookie_names = ['csrftoken', getattr(settings, 'SESSION_COOKIE_NAME', 'sessionid')]
            for cookie_name in target_cookie_names:
                if cookie_name in response.cookies:
                    c = response.cookies[cookie_name]
                    c['samesite'] = 'Lax'
                    c['secure'] = False
        except Exception:
            # Do not block response on any failure here
            return response

        return response


