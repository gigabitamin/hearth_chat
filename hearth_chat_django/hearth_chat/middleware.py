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



class MobileCSRFFallbackMiddleware(MiddlewareMixin):
    """Inject CSRF cookie from X-CSRFToken header for mobile WebView requests.

    Some WebViews do not persist cross-site cookies visibly to document.cookie
    even though requests are credentialed. To ensure Django's CSRF check passes
    for first-party API calls from native apps, if a request includes a valid
    'X-CSRFToken' header but lacks the 'csrftoken' cookie, we mirror the header
    value into the request cookies prior to CsrfViewMiddleware.
    """

    def process_request(self, request):
        try:
            # Detect mobile/native context
            origin = request.headers.get('Origin', '') or request.headers.get('Referer', '') or ''
            is_mobile_webview = (
                origin.startswith('capacitor://') or
                origin.startswith('http://localhost') or
                origin.startswith('https://localhost') or
                request.headers.get('X-From-App') == '1'
            )

            if not is_mobile_webview:
                return None

            header_token = request.headers.get('X-CSRFToken') or request.META.get('HTTP_X_CSRFTOKEN')
            if not header_token:
                return None

            cookie_name = getattr(settings, 'CSRF_COOKIE_NAME', 'csrftoken')
            has_cookie = bool(request.COOKIES.get(cookie_name))
            if not has_cookie:
                # Mirror header token into request cookies and META so CsrfViewMiddleware can validate
                try:
                    request.COOKIES[cookie_name] = header_token
                except Exception:
                    pass
                request.META['CSRF_COOKIE'] = header_token
        except Exception:
            # Never block the request here
            return None

        return None

