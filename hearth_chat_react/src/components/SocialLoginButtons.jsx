import React from 'react';
import './SocialLoginButtons.css';
import { API_BASE } from '../utils/apiConfig';

// BACKEND_URL을 API_BASE로 사용
const BACKEND_URL = API_BASE;

const SOCIALS = [
    {
        name: 'Google',
        // Django Allauth 중간창 우회를 위해 직접 OAuth URL 사용
        url: `${BACKEND_URL}/oauth/google/`,
        className: 'google',
        logo: process.env.PUBLIC_URL + '/oauth_logo/Google.svg',
    },
    {
        name: 'Kakao',
        // Django Allauth 중간창 우회를 위해 직접 OAuth URL 사용
        url: `${BACKEND_URL}/oauth/kakao/`,
        className: 'kakao',
        logo: process.env.PUBLIC_URL + '/oauth_logo/KakaoTalk.svg',
    },
    {
        name: 'Naver',
        // Django Allauth 중간창 우회를 위해 직접 OAuth URL 사용
        url: `${BACKEND_URL}/oauth/naver/`,
        className: 'naver',
        logo: process.env.PUBLIC_URL + '/oauth_logo/Naver.svg',
    },
    {
        name: 'GitHub',
        // Django Allauth 중간창 우회를 위해 직접 OAuth URL 사용
        url: `${BACKEND_URL}/oauth/github/`,
        className: 'github',
        logo: process.env.PUBLIC_URL + '/oauth_logo/Github.svg',
    },
];

export default function SocialLoginButtons({ onSocialLogin }) {
    // 카카오 로그아웃-재로그인 핸들러
    const handleKakaoLogin = (loginUrl) => {
        const kakaoLogoutUrl = `https://kauth.kakao.com/oauth/logout?client_id=478186fe798621a0f6b66cc28b4028b0&logout_redirect_uri=${encodeURIComponent(loginUrl)}`;
        // 새 창에서 로그아웃 → 로그인 순차 진행
        window.open(kakaoLogoutUrl, '_blank', 'width=500,height=600');
    };
    return (
        <div className="social-login-list">
            {SOCIALS.map(social => (
                <a
                    key={social.name}
                    href={social.url}
                    className={`social-login-btn ${social.className}`}
                    onClick={e => {
                        e.preventDefault();
                        e.stopPropagation(); // 상위로 이벤트 전파 방지
                        if (social.name === 'Kakao') {
                            handleKakaoLogin(social.url);
                        } else {
                            onSocialLogin(social.url);
                        }
                    }}
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