import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HeaderBar.css';
import AboutModal from './AboutModal';
import { API_BASE, getCookie } from '../utils/apiConfig';

const CreateRoomButton = ({ onClick }) => (
    <button
        className="header-create-room-btn"
        onClick={onClick}
        title="새 채팅방 만들기"
        aria-label="새 채팅방 만들기"
        style={{ background: 'none', border: 'none', padding: 0, marginRight: 10, cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
        <span style={{ fontSize: 28, userSelect: 'none', transition: 'transform 0.15s' }} role="img" aria-label="logo">🔥</span>
    </button>
);


export default function HeaderBar({
    activeTab,
    onTabChange,
    onSearchClick,
    onNotifyClick,
    onSettingsClick,
    onCreateRoomClick,
    onLoginClick,
    loginUser,
    title, // 중앙에 표시할 텍스트(채팅방 이름/앱명)
    unreadNotifications = 0, // 읽지 않은 알림 개수
    isInRoom = false, // 새로 추가된 prop
    isFavoriteRoom, // 즐겨찾기 상태
    onToggleFavoriteRoom, // 즐겨찾기 토글 함수
    room,
}) {
    const [showTitlePopup, setShowTitlePopup] = useState(false);
    const titleClickTimer = useRef(null);
    const navigate = useNavigate();
    const [showAboutModal, setShowAboutModal] = useState(false);
    const [ignoreNextMouseUp, setIgnoreNextMouseUp] = useState(false);
    // --- 추가: 모바일 롱클릭 플래그 및 타이머 ---
    const titleTouchTimer = useRef(null);
    const ignoreNextTouchEnd = useRef(false);

    // 즐겨찾기 토글
    const handleFavoriteToggle = async (room, e) => {
        e.stopPropagation();
        if (!loginUser) return;
        const isFav = room.is_favorite;
        const url = `${API_BASE}/api/chat/rooms/${room.id}/${isFav ? 'unfavorite' : 'favorite'}/`;
        const method = isFav ? 'DELETE' : 'POST';
        try {
            const csrftoken = getCookie('csrftoken');
            await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'X-CSRFToken': csrftoken },
            });
        } catch (err) {
            alert('즐겨찾기 처리 실패: ' + err.message);
        }
    };

    // 롱클릭/숏클릭 분기 (PC)
    const handleTitleMouseDown = () => {
        titleClickTimer.current = setTimeout(() => {
            // 롱클릭: 홈으로 이동
            setIgnoreNextMouseUp(true);
            navigate('/');
        }, 600); // 600ms 이상이면 롱클릭
    };
    const handleTitleMouseUp = () => {
        if (titleClickTimer.current) {
            clearTimeout(titleClickTimer.current);
            if (ignoreNextMouseUp) {
                setIgnoreNextMouseUp(false);
                return;
            }
            // 숏클릭: 전체 타이틀 팝업 토글 (채팅방 내부)
            if (isInRoom) {
                setShowTitlePopup(v => !v);
            } else {
                setShowAboutModal(v => !v);
            }
        }
    };
    const handleTitleMouseLeave = () => {
        if (titleClickTimer.current) clearTimeout(titleClickTimer.current);
    };
    // --- 모바일 롱클릭/숏클릭 분기 ---
    const handleTitleTouchStart = () => {
        titleTouchTimer.current = setTimeout(() => {
            ignoreNextTouchEnd.current = true;
            navigate('/');
        }, 600);
    };
    const handleTitleTouchEnd = () => {
        if (titleTouchTimer.current) {
            clearTimeout(titleTouchTimer.current);
            if (ignoreNextTouchEnd.current) {
                ignoreNextTouchEnd.current = false;
                return;
            }
            // 숏클릭: 전체 타이틀 팝업 토글 (채팅방 내부)
            if (isInRoom) {
                setShowTitlePopup(v => !v);
            } else {
                setShowAboutModal(v => !v);
            }
        }
    };
    const handleTitleTouchCancel = () => {
        if (titleTouchTimer.current) clearTimeout(titleTouchTimer.current);
    };

    // 팝업 바깥 클릭 시 닫힘 처리
    React.useEffect(() => {
        if (isInRoom && showTitlePopup) {
            const handleClick = (e) => {
                // 팝업 내부 클릭은 무시
                if (e.target.closest('.header-title-popup')) return;
                setShowTitlePopup(false);
            };
            document.addEventListener('mousedown', handleClick);
            return () => document.removeEventListener('mousedown', handleClick);
        }
    }, [isInRoom, showTitlePopup]);

    return (
        <header className="header-bar">
            <div className="header-left-group">
                {/* 오버레이와 동일한 탭 UI로 교체 */}
                <div className="header-tabs">
                    <button onClick={() => onTabChange('personal')} className={`header-tab-btn${!isInRoom && activeTab === 'personal' ? ' active' : ''}`}>개인</button>
                    <button onClick={() => onTabChange('open')} className={`header-tab-btn${!isInRoom && activeTab === 'open' ? ' active' : ''}`}>오픈</button>
                    <button onClick={() => onTabChange('favorite')} className={`header-tab-btn${!isInRoom && activeTab === 'favorite' ? ' active' : ''}`}>★</button>
                </div>
                {/* <CreateRoomButton onClick={onCreateRoomClick} /> */}
            </div>
            <div className="header-center">
                <div>                    
                    {title && (                                                                    
                        <span
                            className="header-title-text"
                            title={title}
                            onMouseDown={handleTitleMouseDown}
                            onMouseUp={handleTitleMouseUp}
                            onMouseLeave={handleTitleMouseLeave}
                            onTouchStart={handleTitleTouchStart}
                            onTouchEnd={handleTitleTouchEnd}
                            onTouchCancel={handleTitleTouchCancel}
                            style={{
                                maxWidth: 140,                                
                                fontWeight: 600,
                                color: '#23242a',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'inline-block',
                                textAlign: 'center',
                                cursor: 'pointer',
                                verticalAlign: 'middle',
                                userSelect: 'none',
                                padding: '0 8px',
                                lineHeight: '1.2',
                                letterSpacing: '0.2px',
                            }}
                        >
                            {/* 즐겨찾기('★' : '☆') 버튼 */}
                            {isInRoom && <button
                                className="favorite-btn"
                                title={isFavoriteRoom ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                                onClick={e => {
                                    // e.stopPropagation();
                                    handleFavoriteToggle(room, e);
                                    onToggleFavoriteRoom && onToggleFavoriteRoom();
                                }}
                                style={{ marginRight: 6, background: 'none', border: 'none', fontSize: 16, color: '#FFD600', cursor: 'pointer', paddingRight: 10, paddingLeft: 0}}
                            >
                                <div style={{ background: 'none', border: 'none', fontSize: 16, color: '#FFD600', cursor: 'pointer'}}>{isFavoriteRoom ? '★' : '☆'}</div>
                            </button>                            
                            }
                            {title}                            
                        </span>                        
                    )}
                {/* 전체 타이틀 팝업 (채팅방 내부) */}
                    {isInRoom && showTitlePopup && (
                        <div
                            className="header-title-popup"
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: 44,
                                transform: 'translateX(-50%)',
                                background: '#fff',
                                color: '#23242a',
                                border: '1px solid #ddd',
                                borderRadius: 8,
                                boxShadow: '0 4px 16px rgba(0,0,0,0.13)',
                                padding: '16px 24px',
                                zIndex: 9999,
                                minWidth: 120,
                                maxWidth: 420,
                                fontSize: '1.08rem',
                                fontWeight: 600,
                                textAlign: 'center',
                                wordBreak: 'break-all',
                                whiteSpace: 'pre-line',
                                cursor: 'pointer',
                            }}
                            onClick={() => setShowTitlePopup(false)}
                        >
                            {title}
                        </div>
                    )}
                    {/* About/QnA/HelpEmail 모달 (대기방에서만) */}
                    {!isInRoom && showAboutModal && (
                        <AboutModal open={showAboutModal} onClose={() => setShowAboutModal(false)} />
                    )}
                </div>
            </div>
            <div className="header-actions">
                {/* 로그인/유저 버튼 */}
                {loginUser ? (
                    <div>
                        {/* <button className="header-action-btn" onClick={onSettingsClick} title="내 계정"></button> */}
                    </div>
                ) : (
                    <button
                        className="header-action-btn"
                        onClick={() => {
                            // console.log('HeaderBar 로그인 버튼 클릭됨!');
                            onLoginClick();
                        }}
                        title="로그인"
                        style={{
                            marginRight: 8,
                            background: '#f0f0f0',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            padding: '4px 4px',
                            cursor: 'pointer',
                            zIndex: 1000,
                        }}
                    >
                        <span role="img" aria-label="login" style={{ fontSize: 20 }}>🔑</span>
                    </button>
                )}
                <button className="header-action-btn" onClick={onSearchClick} title="검색">
                    <span role="img" aria-label="search">🔍︎</span>
                </button>
                <button className="header-action-btn notify-btn" onClick={onNotifyClick} title="알림">
                    <span role="img" aria-label="notify">🔔</span>
                    {unreadNotifications > 0 && (
                        <span className="notification-badge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>
                    )}
                </button>
                <button className="header-action-btn" onClick={() => {
                    // console.log('HeaderBar 설정 버튼 클릭됨!');
                    onSettingsClick();
                }} title="설정">
                    <span role="img" aria-label="settings" style={{ fontSize: 22 }}>⚙️</span>
                </button>
            </div>
        </header>
    );
} 