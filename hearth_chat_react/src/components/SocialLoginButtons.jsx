import React from 'react';
import './SocialLoginButtons.css';

// 환경에 따라 BACKEND_URL 자동 설정
const hostname = window.location.hostname;
const isProd = process.env.NODE_ENV === 'production';
const BACKEND_URL = isProd
    ? 'https://hearthchat-production.up.railway.app'
    : (hostname === 'localhost' || hostname === '127.0.0.1')
        ? 'http://localhost:8000'
        : hostname === '192.168.44.9'
            ? 'http://192.168.44.9:8000'
            : `http://${hostname}:8000`;

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
    return (
        <div className="social-login-list">
            {SOCIALS.map(social => (
                <a
                    key={social.name}
                    href={social.url}
                    className={`social-login-btn ${social.className}`}
                    onClick={e => {
                        e.preventDefault();
                        onSocialLogin(social.url);
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