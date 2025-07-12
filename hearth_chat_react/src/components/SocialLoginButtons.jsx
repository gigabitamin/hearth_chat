import React from 'react';
import './SocialLoginButtons.css';

// 환경에 따라 BACKEND_URL 자동 설정
const BACKEND_URL = process.env.NODE_ENV === 'production'
    ? 'https://hearthchat-production.up.railway.app'
    : 'http://localhost:8000';

const SOCIALS = [
    {
        name: 'Google',
        url: `${BACKEND_URL}/accounts/google/login/`,
        className: 'google',
        logo: process.env.PUBLIC_URL + '/oauth_logo/Google.svg',
    },
    {
        name: 'Kakao',
        url: `${BACKEND_URL}/accounts/kakao/login/`,
        className: 'kakao',
        logo: process.env.PUBLIC_URL + '/oauth_logo/KakaoTalk.svg',
    },
    {
        name: 'Naver',
        url: `${BACKEND_URL}/accounts/naver/login/`,
        className: 'naver',
        logo: process.env.PUBLIC_URL + '/oauth_logo/Naver.svg',
    },
    {
        name: 'GitHub',
        url: `${BACKEND_URL}/accounts/github/login/`,
        className: 'github',
        logo: process.env.PUBLIC_URL + '/oauth_logo/Github.svg',
    },
];

export default function SocialLoginButtons() {
    // 팝업 열기 함수
    const handleSocialLogin = (url) => (e) => {
        e.preventDefault();
        const popupWidth = 480;
        const popupHeight = 600;
        const left = window.screenX + (window.outerWidth - popupWidth) / 2;
        const top = window.screenY + (window.outerHeight - popupHeight) / 2;

        const popup = window.open(
            url,
            'social_login_popup',
            `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
        );

        // 팝업창 상태 모니터링
        const checkPopupStatus = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkPopupStatus);
                // 팝업이 닫히면 페이지 새로고침하여 로그인 상태 갱신
                window.location.reload();
            }
        }, 1000);

        // postMessage 이벤트 리스너 (백엔드에서 로그인 완료 시 메시지 전송)
        const handleMessage = (event) => {
            console.log('SocialLoginButtons: 메시지 수신:', event.data);
            if (event.data === 'login_success' || event.data === 'social_login_complete') {
                console.log('SocialLoginButtons: 로그인 성공 메시지 수신');
                clearInterval(checkPopupStatus);
                window.removeEventListener('message', handleMessage);
                popup.close();
                window.location.reload();
            }
        };
        window.addEventListener('message', handleMessage);
    };

    return (
        <div className="social-login-list">
            {SOCIALS.map(social => (
                <a
                    key={social.name}
                    href={social.url}
                    className={`social-login-btn ${social.className}`}
                    onClick={handleSocialLogin(social.url)}
                >
                    <img
                        src={social.logo}
                        alt={`${social.name} logo`}
                        style={{ width: 24, height: 24, background: 'transparent' }}
                    />
                    {social.name} 로 로그인
                </a>
            ))}
        </div>
    );
}