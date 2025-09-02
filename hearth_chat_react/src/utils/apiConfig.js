// 환경에 따라 API_BASE 자동 설정 함수
/*
// [보존용 주석] 이전 getApiBase 구현 (프로덕션 도메인별 분기 + fly.dev 기본값)
// 필요 시 이 블록을 참고해 수동으로 복원/수정할 수 있습니다.
// export const getApiBase = () => {
//     const hostname = window.location.hostname;
//     const isProd = process.env.NODE_ENV === 'production';
//
//     if (isProd) {
//         if (hostname.includes('onrender.com')) {
//             return `https://${hostname}`;
//         }
//         if (hostname.includes('up.railway.app')) {
//             return `https://${hostname}`;
//         }
//         return 'https://hearth-chat.fly.dev';
//     }
//
//     if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8000';
//     if (hostname === '192.168.44.9') return 'http://192.168.44.9:8000';
//     return `http://${hostname}:8000`;
// };
*/

// 환경에 따라 API_BASE 자동 설정 함수
export const getApiBase = () => {
    const hostname = window.location.hostname;
    const origin = window.location.origin; // https://<host>[:port]
    const isProd = process.env.NODE_ENV === 'production';

    // 모바일 WebView/네이티브 환경 감지 강화
    const ua = (navigator && navigator.userAgent) ? navigator.userAgent : '';
    const isAndroidWebView = /; wv\)/i.test(ua) || /Version\/4\.0\s+Chrome\//i.test(ua);
    const isHttpsLocalhost = origin.startsWith('https://localhost');
    const isNativeLike = (() => {
        try {
            if (window.location.protocol === 'capacitor:') return true;
            const C = window.Capacitor;
            if (C && typeof C.getPlatform === 'function' && C.getPlatform() !== 'web') return true;
        } catch { /* ignore */ }
        return isAndroidWebView || isHttpsLocalhost;
    })();

    // 네이티브/웹뷰(https://localhost 포함)에서는 고정 도메인 사용
    if (isNativeLike) {
        const envBase = process.env.REACT_APP_API_BASE;
        const lsBase = (() => { try { return localStorage.getItem('API_BASE'); } catch { return null; } })();
        
        // --- [수정된 부분] ---
        // 모바일 앱(APK)이 바라볼 기본 서버 주소를 커스텀 도메인으로 변경
        const fallbackBase = 'https://hearthchat.app';
        // ---
        
        return envBase || lsBase || fallbackBase;
    }

    // 프로덕션 웹에서는 항상 현재 출처(origin)를 사용해 동일 출처 쿠키/CSRF 보장
    if (isProd) return origin;

    // 로컬 개발 환경
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8000';
    if (hostname === '192.168.44.9') return 'http://192.168.44.9:8000';

    // 기타 비프로덕션 환경에서는 호스트명 기반 기본값
    return `http://${hostname}:8000`;
};

// 환경에 따라 Lily LLM API URL 자동 설정 함수
export const getLilyApiUrl = () => {
    const hostname = window.location.hostname;
    const isProd = process.env.NODE_ENV === 'production';

    // Capacitor(모바일 네이티브) 환경 감지 (강화)
    const isNative = (() => {
        try {
            if (window.location.protocol === 'capacitor:') return true;
            const C = window.Capacitor;
            if (!C) return false;
            if (typeof C.isNativePlatform === 'function') return !!C.isNativePlatform();
            if (typeof C.getPlatform === 'function') return C.getPlatform() !== 'web';
            return false;
        } catch { return false; }
    })();

    // 1순위: 환경변수(REACT_APP_LILY_API_URL)
    // 2순위: 로컬 스토리지 사용자 설정(LILY_API_URL)
    const envLily = process.env.REACT_APP_LILY_API_URL;
    const lsLily = (() => { try { return localStorage.getItem('LILY_API_URL'); } catch { return null; } })();
    if (envLily || lsLily) return envLily || lsLily;

    // 프로덕션 환경에서는 허깅페이스 FastAPI 서버 사용
    if (isProd || isNative) {
        return 'https://gbrabbit-lily-fast-api.hf.space';
    }

    // 로컬 개발 환경에서는 로컬 FastAPI 서버 사용
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8001';
    if (hostname === '192.168.44.9') return 'http://192.168.44.9:8001';

    // 기타 환경에서는 호스트명 기반으로 설정
    return `http://${hostname}:8001`;
};

// API_BASE 상수
export const API_BASE = getApiBase();

// Lily API URL 상수
export const LILY_API_URL = getLilyApiUrl();

// 공통 WebSocket URL 생성기 (모바일/웹 환경 모두 대응)
export const getWebSocketUrl = (endpointPath = '/ws/chat/') => {
    // 동적으로 최신 API_BASE를 계산하여 WebView(https://localhost)에서도 올바른 도메인으로 연결
    const base = getApiBase(); // e.g., https://example.com or http://localhost:8000
    const isSecure = /^https:\/\//i.test(base);
    const wsScheme = isSecure ? 'wss://' : 'ws://';
    const withoutScheme = base.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const path = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    return `${wsScheme}${withoutScheme}${path}`;
};

// CSRF 토큰 쿠키 가져오기
export function getCookie(name) {
    try {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    } catch { /* ignore */ }
}

// CSRF 토큰이 포함된 fetch 함수
export const csrfFetch = async (url, options = {}) => {
    // 1) 보장: 쿠키에서 토큰 시도
    let csrftoken = getCookie('csrftoken');
    // 2) 없으면 /api/csrf/ 호출로 토큰 JSON 확보
    if (!csrftoken && url.indexOf('/api/csrf/') === -1) {
        try {
            const r = await fetch(`${API_BASE}/api/csrf/`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'X-From-App': '1' }
            });
            const data = await r.json().catch(() => ({}));
            csrftoken = data && data.token ? data.token : getCookie('csrftoken');
        } catch { /* ignore */ }
    }

    const defaultHeaders = {
        'X-CSRFToken': csrftoken || '',
        'Content-Type': 'application/json',
        'X-From-App': '1',
    };

    const mergedOptions = {
        credentials: 'include',
        ...options,
        headers: {
            ...defaultHeaders,
            ...(options.headers || {}),
        },
    };

    return fetch(url, mergedOptions);
};