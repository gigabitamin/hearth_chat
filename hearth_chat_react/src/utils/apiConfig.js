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

export const getApiBase = () => {
    const hostname = window.location.hostname;
    const origin = window.location.origin; // https://<host>[:port]
    const isProd = process.env.NODE_ENV === 'production';

    // 프로덕션에서는 항상 현재 출처(origin)를 사용해 동일 출처 쿠키/CSRF 보장
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

    // console.log('🔧 LILY_API_URL 환경 감지:', { hostname, isProd, NODE_ENV: process.env.NODE_ENV });

    // 프로덕션 환경에서는 허깅페이스 FastAPI 서버 사용
    if (isProd) {
        // Render나 Railway 환경에서도 허깅페이스 서버 사용
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

// CSRF 토큰 쿠키 가져오기
export function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// CSRF 토큰이 포함된 fetch 함수
export const csrfFetch = async (url, options = {}) => {
    const csrftoken = getCookie('csrftoken');
    const defaultHeaders = {
        'X-CSRFToken': csrftoken,
        'Content-Type': 'application/json',
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