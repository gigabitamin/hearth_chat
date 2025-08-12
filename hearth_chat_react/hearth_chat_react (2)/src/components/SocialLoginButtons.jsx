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

        // 먼저 로그인 모달을 닫기 위해 onSocialLogin 호출
        onSocialLogin(loginUrl);

        // 그 다음 카카오 로그아웃 → 재로그인 팝업 열기
        setTimeout(() => {
            const popup = window.open(kakaoLogoutUrl, 'social_login', 'width=500,height=600');

            // 카카오 로그인 팝업도 감시
            if (popup) {
                console.log('[DEBUG] 카카오 로그인 팝업 감시 시작');
                const checkClosed = setInterval(() => {
                    console.log('[DEBUG] 카카오 팝업 상태 확인 중... closed:', popup.closed);
                    if (popup.closed) {
                        console.log('[DEBUG] 카카오 팝업 닫힘 감지!');
                        clearInterval(checkClosed);

                        // 카카오 로그인 완료 후 세션 업데이트 대기
                        console.log('[DEBUG] 카카오 소셜 로그인 세션 업데이트 대기 시작');

                        // 세션 업데이트 확인을 위한 재시도 로직
                        let retryCount = 0;
                        const maxRetries = 10;

                        const checkSessionUpdate = async () => {
                            try {
                                console.log(`[DEBUG] 카카오 세션 확인 시도 ${retryCount + 1}/${maxRetries}`);
                                const response = await fetch(`${window.location.origin}/api/chat/user/settings/`, {
                                    credentials: 'include',
                                });

                                if (response.ok) {
                                    console.log('[DEBUG] 카카오 세션 업데이트 확인됨! 로그인 성공');
                                    // 페이지 갱신
                                    setTimeout(() => {
                                        window.location.reload();
                                    }, 500);
                                    return;
                                } else {
                                    console.log(`[DEBUG] 카카오 세션 아직 업데이트 안됨 (${response.status}), 재시도...`);
                                    retryCount++;

                                    if (retryCount < maxRetries) {
                                        setTimeout(checkSessionUpdate, 1000);
                                    } else {
                                        console.log('[DEBUG] 카카오 최대 재시도 횟수 도달');
                                    }
                                }
                            } catch (error) {
                                console.error('[DEBUG] 카카오 세션 확인 중 오류:', error);
                                retryCount++;

                                if (retryCount < maxRetries) {
                                    setTimeout(checkSessionUpdate, 1000);
                                }
                            }
                        };

                        // 첫 번째 세션 확인 시작
                        checkSessionUpdate();
                    }
                }, 200);
            }
        }, 100); // 100ms 후 팝업 열기
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