// 환경에 따라 API_BASE 자동 설정 함수
export const getApiBase = () => {
    const hostname = window.location.hostname;
    const isProd = process.env.NODE_ENV === 'production';


    if (isProd) return 'https://hearthchat-production.up.railway.app';
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8000';
    if (hostname === '192.168.44.9') return 'http://192.168.44.9:8000';
    return `http://${hostname}:8000`;
};

// 환경에 따라 Lily LLM API URL 자동 설정 함수
export const getLilyApiUrl = () => {
    const hostname = window.location.hostname;
    const isProd = process.env.NODE_ENV === 'production';

    // console.log('🔧 LILY_API_URL 환경 감지:', { hostname, isProd, NODE_ENV: process.env.NODE_ENV });

    // 프로덕션 환경에서는 허깅페이스 FastAPI 서버 사용
    if (isProd) return 'https://gbrabbit-lily-fast-api.hf.space';

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