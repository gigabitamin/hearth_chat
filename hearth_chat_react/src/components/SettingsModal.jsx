import React, { useState, useEffect } from 'react';
import './SettingsModal.css';
import VoiceRecognition from './VoiceRecognition';


// 환경에 따라 API_BASE 자동 설정
const hostname = window.location.hostname;
const isProd = process.env.NODE_ENV === 'production';
const API_BASE = isProd
  ? 'https://hearthchat-production.up.railway.app'
  : (hostname === 'localhost' || hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : hostname === '192.168.44.9'
      ? 'http://192.168.44.9:8000'
      : `http://${hostname}:8000`;

const ALLAUTH_BASE = `${API_BASE}/accounts`;

const SOCIAL_PROVIDERS = [
  { provider: 'google', label: 'Google' },
  { provider: 'kakao', label: 'Kakao' },
  { provider: 'naver', label: 'Naver' },
  { provider: 'github', label: 'GitHub' },
];

function getProviderLabel(provider) {
  if (provider === 'google') return 'Google';
  if (provider === 'kakao') return 'Kakao';
  if (provider === 'naver') return 'Naver';
  if (provider === 'github') return 'GitHub';
  return provider;
}

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

const tabList = [
  { key: 'user', label: '유저' },
  { key: 'tts', label: 'TTS' },
  { key: 'voice', label: '음성인식' },
  { key: 'camera', label: '카메라' },
  { key: 'avatar', label: '아바타' },
  { key: 'ai', label: 'AI 응답' },
  { key: 'notify', label: '알림' },
  { key: 'chat', label: '채팅' },
  { key: 'display', label: '화면' },
  { key: 'etc', label: '기타' },
];

const SettingsModal = ({
  isOpen, onClose, tab, setTab, userSettings, setUserSettings,
  voiceList, ttsVoice, setTtsVoice, ttsRate, setTtsRate, ttsPitch, setTtsPitch,
  isTTSEnabled, setIsTTSEnabled,
  isVoiceRecognitionEnabled, setIsVoiceRecognitionEnabled,
  autoSend, setAutoSend,
  isContinuousRecognition, setIsContinuousRecognition,
  voiceRecognitionRef,
  handleVoiceRecognitionToggle,
  permissionStatus,
  requestMicrophonePermission,
  loginUser
}) => {
  console.log('SettingsModal 렌더링:', { isOpen, tab, loginUser });
  const [saving, setSaving] = useState(false);

  // voiceList가 undefined일 경우 빈 배열로 초기화
  const safeVoiceList = voiceList || [];

  // 유저 관련 상태들
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);

  // 이메일 변경 상태
  const [emailForm, setEmailForm] = useState('');
  const [emailMsg, setEmailMsg] = useState(null);
  // 비밀번호 변경 상태
  const [pwForm, setPwForm] = useState({ old: '', pw1: '', pw2: '' });
  const [pwMsg, setPwMsg] = useState(null);

  // 계정 연결 상태
  const [connections, setConnections] = useState([]);
  const [connMsg, setConnMsg] = useState(null);

  // 회원탈퇴 관련 상태
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // 계정 연결 상태 fetch 함수 분리 (JSON API 사용)
  const fetchConnections = () => {
    fetch(`${API_BASE}/api/social-connections/`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setConnections(data.social_accounts || []);
      })
      .catch(() => setConnections([]));
  };

  // 계정 연결 모달 열릴 때 목록 조회
  useEffect(() => {
    if (showConnectionsModal) {
      fetchConnections();
    }
  }, [showConnectionsModal]);

  // 회원탈퇴 핸들러
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE_ACCOUNT') {
      setDeleteError('정확한 확인 문구를 입력해주세요.');
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const csrftoken = getCookie('csrftoken');
      const res = await fetch(`${API_BASE}/api/chat/user/delete/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message || '회원탈퇴가 완료되었습니다.');
        // 로컬 쿠키도 정리
        document.cookie = 'sessionid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        window.location.href = '/';
      } else {
        const errorData = await res.json().catch(() => ({}));
        setDeleteError(errorData.error || '회원탈퇴에 실패했습니다.');
      }
    } catch (error) {
      setDeleteError('서버 오류: ' + error.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // 소셜 계정 해제
  const handleDisconnect = async (provider) => {
    setConnMsg(null);
    const csrftoken = getCookie('csrftoken');
    if (!csrftoken) {
      setConnMsg('CSRF 토큰이 없습니다. 새로고침 후 다시 시도해 주세요.');
      return;
    }
    const form = new FormData();
    form.append('action', 'disconnect');
    form.append('account', provider);
    try {
      const res = await fetch(`${API_BASE}/api/social-connections/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRFToken': csrftoken },
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        setConnMsg(data.message || '연결 해제 성공');
        // 목록 갱신
        fetchConnections();
      } else {
        const errorData = await res.json().catch(() => ({}));
        setConnMsg(errorData.message || '연결 해제 실패');
      }
    } catch (error) {
      setConnMsg('서버 오류: ' + error.message);
    }
  };

  // 소셜 계정 연결(팝업)
  const handleConnect = (provider) => {
    const popupWidth = 480;
    const popupHeight = 600;
    const left = window.screenX + (window.outerWidth - popupWidth) / 2;
    const top = window.screenY + (window.outerHeight - popupHeight) / 2;

    window.open(
      `${API_BASE}/accounts/${provider}/login/?process=connect`,
      'social_connect',
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );
  };

  // 유저 정보 로드
  useEffect(() => {
    if (isOpen && tab === 'user') {
      console.log('SettingsModal user tab opened, loginUser:', loginUser);
      setLoading(true);
      if (loginUser) {
        setUser(loginUser);
        setError(null);
        setLoading(false);
      } else {
        fetch(`${API_BASE}/api/chat/user/`, { credentials: 'include' })
          .then(res => res.json())
          .then(data => {
            if (data.status === 'success') {
              setUser(data.user);
              setError(null);
            } else {
              setUser(null);
              setError(data.message || '로그인 정보 없음');
            }
          })
          .catch(() => setError('서버 오류'))
          .finally(() => setLoading(false));
      }
    }
  }, [isOpen, tab, loginUser]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    const csrftoken = getCookie('csrftoken');
    if (!csrftoken) {
      setError('CSRF 토큰이 없습니다. 새로고침 후 다시 시도해 주세요.');
      setLogoutLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/chat/logout/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': csrftoken,
          'Content-Type': 'application/json'
        },
      });
      if (res.ok) {
        // 로컬 쿠키도 정리
        document.cookie = 'sessionid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

        setLogoutLoading(false);
        setUser(null);
        onClose();
        window.location.reload(); // 상태 갱신을 위해 새로고침
      } else {
        setError('로그아웃 실패');
        setLogoutLoading(false);
      }
    } catch (error) {
      setError('서버 오류');
      setLogoutLoading(false);
    }
  };

  // 이메일 변경 핸들러
  const handleEmailChange = async (e) => {
    e.preventDefault();
    setEmailMsg(null);
    const csrftoken = getCookie('csrftoken');
    const form = new FormData();
    form.append('email', emailForm);
    try {
      const res = await fetch(`${ALLAUTH_BASE}/email/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRFToken': csrftoken },
        body: form,
      });
      const text = await res.text();
      if (res.ok) {
        setEmailMsg('이메일 변경 요청이 완료되었습니다. (확인 메일을 확인하세요)');
      } else {
        setEmailMsg('실패: ' + (text.match(/<li>(.*?)<\/li>/)?.[1] || '입력값을 확인하세요.'));
      }
    } catch {
      setEmailMsg('서버 오류');
    }
  };

  // 비밀번호 변경 핸들러
  const handlePwChange = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (pwForm.pw1 !== pwForm.pw2) {
      setPwMsg('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    const csrftoken = getCookie('csrftoken');
    const form = new FormData();
    form.append('oldpassword', pwForm.old);
    form.append('password1', pwForm.pw1);
    form.append('password2', pwForm.pw2);
    try {
      const res = await fetch(`${ALLAUTH_BASE}/password/change/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRFToken': csrftoken },
        body: form,
      });
      const text = await res.text();
      if (res.ok) {
        setPwMsg('비밀번호가 성공적으로 변경되었습니다.');
      } else {
        setPwMsg('실패: ' + (text.match(/<li>(.*?)<\/li>/)?.[1] || '입력값을 확인하세요.'));
      }
    } catch {
      setPwMsg('서버 오류');
    }
  };

  if (!isOpen) return null;

  // 서버에 설정 저장
  const saveSetting = async (patchObj) => {
    setSaving(true);
    try {
      // 프론트 상태명 → 서버 필드명 매핑
      const keyMap = {
        ttsEnabled: 'tts_enabled',
        ttsVoice: 'tts_voice',
        ttsRate: 'tts_speed',
        ttsPitch: 'tts_pitch',
        voiceRecognitionEnabled: 'voice_recognition_enabled',
        autoSend: 'auto_send_enabled',
        cameraActive: 'camera_enabled',
        avatarOn: 'user_avatar_enabled',
        aiAvatarOn: 'ai_avatar_enabled',
        ai_avatar_enabled: 'ai_avatar_enabled',
        userAvatarEnabled: 'user_avatar_enabled',
        user_avatar_enabled: 'user_avatar_enabled',
        ai_response_enabled: 'ai_response_enabled',
      };
      // 매핑 적용
      const serverPatch = {};
      Object.entries(patchObj).forEach(([k, v]) => {
        const mappedKey = keyMap[k] || k;
        serverPatch[mappedKey] = v;
      });

      // CSRF 토큰 추출
      const csrftoken = document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];

      const res = await fetch(`${API_BASE}/api/chat/user/settings/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify(serverPatch),
      });
      if (res.ok) {
        const data = await res.json();
        setUserSettings(data.settings || { ...userSettings, ...serverPatch });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-modal-header">
          {/* <h2>설정</h2> */}
          <button className="settings-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="settings-modal-tabs">
          {tabList.map(t => (
            <button
              key={t.key}
              className={tab === t.key ? 'settings-modal-tab-active' : 'settings-modal-tab'}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="settings-modal-content">
          {tab === 'user' && (
            <div>
              {loading ? (
                <div>로딩 중...</div>
              ) : error ? (
                <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>
              ) : user ? (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 20 }}>{user.username}</div>
                    <div style={{ color: '#888', fontSize: 15 }}>{user.email}</div>
                    <div style={{ marginTop: 8, fontSize: 13, color: '#888' }}>
                      로그인 방식: {user.social_accounts && user.social_accounts.length > 0 ? (
                        <>
                          {user.social_accounts.map(p => getProviderLabel(p)).join(', ')}
                          {user.has_password ? ' + 이메일/비밀번호' : ''}
                        </>
                      ) : '이메일/비밀번호'}
                    </div>
                    {user.email && (
                      <div style={{ marginTop: 4, fontSize: 12, color: user.email_verified ? '#4caf50' : '#ff9800' }}>
                        이메일: {user.email} {user.email_verified ? '✅' : '⚠️ 미인증'}
                      </div>
                    )}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    <li>
                      <button
                        className="settings-modal-button"
                        style={{ width: '100%', marginBottom: 8 }}
                        onClick={() => setShowEmailModal(true)}
                      >
                        이메일 변경
                      </button>
                    </li>
                    <li>
                      {user.is_social_only ? (
                        <div style={{ color: '#888', fontSize: 14, marginBottom: 8, textAlign: 'center' }}>
                          소셜 계정만 연결된 사용자는 비밀번호를 변경할 수 없습니다.
                        </div>
                      ) : (
                        <button
                          className="settings-modal-button"
                          style={{ width: '100%', marginBottom: 8 }}
                          onClick={() => setShowPasswordModal(true)}
                        >
                          비밀번호 변경
                        </button>
                      )}
                    </li>
                    <li>
                      <button
                        className="settings-modal-button"
                        style={{ width: '100%', marginBottom: 8 }}
                        onClick={() => setShowConnectionsModal(true)}
                      >
                        계정 연결
                      </button>
                    </li>
                    <li>
                      <button
                        className="settings-modal-button"
                        style={{ width: '100%', background: '#eee', color: '#333' }}
                        onClick={handleLogout}
                        disabled={logoutLoading}
                      >
                        {logoutLoading ? '로그아웃 중...' : '로그아웃'}
                      </button>
                    </li>
                    <li>
                      <button
                        className="settings-modal-button"
                        style={{ width: '100%', background: '#f44336', color: '#fff' }}
                        onClick={() => setShowDeleteConfirmModal(true)}
                      >
                        회원탈퇴
                      </button>
                    </li>
                  </ul>
                  {/* 이메일 변경 모달 */}
                  {showEmailModal && (
                    <div className="settings-modal-overlay" onClick={() => { setShowEmailModal(false); setEmailMsg(null); }}>
                      <div className="settings-modal" onClick={e => e.stopPropagation()}>
                        <div className="settings-modal-header">
                          <h2>이메일 변경</h2>
                          <button className="settings-modal-close" onClick={() => { setShowEmailModal(false); setEmailMsg(null); }} aria-label="닫기">✕</button>
                        </div>
                        <div className="settings-modal-content">
                          <form className="settings-modal-form" onSubmit={handleEmailChange}>
                            <input type="email" className="settings-modal-input" placeholder="새 이메일 주소" value={emailForm} onChange={e => setEmailForm(e.target.value)} required />
                            <button className="settings-modal-button" style={{ width: '100%' }} type="submit">변경</button>
                          </form>
                          {emailMsg && <div style={{ color: emailMsg.startsWith('실패') ? 'red' : 'green', marginTop: 8, textAlign: 'center' }}>{emailMsg}</div>}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* 비밀번호 변경 모달 */}
                  {showPasswordModal && (
                    <div className="settings-modal-overlay" onClick={() => { setShowPasswordModal(false); setPwMsg(null); }}>
                      <div className="settings-modal" onClick={e => e.stopPropagation()}>
                        <div className="settings-modal-header">
                          <h2>비밀번호 변경</h2>
                          <button className="settings-modal-close" onClick={() => { setShowPasswordModal(false); setPwMsg(null); }} aria-label="닫기">✕</button>
                        </div>
                        <div className="settings-modal-content">
                          <form className="settings-modal-form" onSubmit={handlePwChange}>
                            <input type="password" className="settings-modal-input" placeholder="현재 비밀번호" value={pwForm.old} onChange={e => setPwForm(f => ({ ...f, old: e.target.value }))} required />
                            <input type="password" className="settings-modal-input" placeholder="새 비밀번호" value={pwForm.pw1} onChange={e => setPwForm(f => ({ ...f, pw1: e.target.value }))} required />
                            <input type="password" className="settings-modal-input" placeholder="새 비밀번호 확인" value={pwForm.pw2} onChange={e => setPwForm(f => ({ ...f, pw2: e.target.value }))} required />
                            <button className="settings-modal-button" style={{ width: '100%' }} type="submit">변경</button>
                          </form>
                          {pwMsg && <div style={{ color: pwMsg.startsWith('실패') ? 'red' : 'green', marginTop: 8, textAlign: 'center' }}>{pwMsg}</div>}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* 계정 연결 모달 */}
                  {showConnectionsModal && (
                    <div className="settings-modal-overlay" onClick={() => { setShowConnectionsModal(false); setConnMsg(null); }}>
                      <div className="settings-modal" onClick={e => e.stopPropagation()}>
                        <div className="settings-modal-header">
                          <h2>계정 연결</h2>
                          <button className="settings-modal-close" onClick={() => { setShowConnectionsModal(false); setConnMsg(null); }} aria-label="닫기">✕</button>
                        </div>
                        <div className="settings-modal-content">
                          <div style={{ marginBottom: 12 }}>
                            <b>연결된 소셜 계정:</b><br />
                            {connections.length > 0 ? (
                              connections.map(acc => (
                                <span key={acc.provider} style={{ marginRight: 8 }}>
                                  {getProviderLabel(acc.provider)}
                                  <button style={{ marginLeft: 6, fontSize: 13 }} onClick={() => handleDisconnect(acc.provider)}>해제</button>
                                </span>
                              ))
                            ) : '없음'}
                          </div>
                          <div style={{ marginBottom: 12 }}>
                            <b>연결 가능한 소셜 계정:</b><br />
                            {SOCIAL_PROVIDERS.filter(p => !connections.find(c => c.provider === p.provider)).map(p => (
                              <button key={p.provider} className="settings-modal-button" style={{ marginRight: 8, marginBottom: 8, fontSize: 15, padding: '6px 12px' }} onClick={() => handleConnect(p.provider)}>
                                {p.label} 연결
                              </button>
                            ))}
                          </div>
                          {connMsg && <div style={{ color: connMsg.includes('성공') ? 'green' : 'red', marginTop: 8, textAlign: 'center' }}>{connMsg}</div>}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* 회원탈퇴 확인 모달 */}
                  {showDeleteConfirmModal && (
                    <div className="settings-modal-overlay" onClick={() => { setShowDeleteConfirmModal(false); setDeleteConfirmation(''); setDeleteError(null); }}>
                      <div className="settings-modal" onClick={e => e.stopPropagation()}>
                        <div className="settings-modal-header">
                          <h2>회원탈퇴</h2>
                          <button className="settings-modal-close" onClick={() => { setShowDeleteConfirmModal(false); setDeleteConfirmation(''); setDeleteError(null); }} aria-label="닫기">✕</button>
                        </div>
                        <div className="settings-modal-content">
                          <div style={{ marginBottom: 16, textAlign: 'center' }}>
                            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#f44336', marginBottom: 8 }}>
                              ⚠️ 회원탈퇴 주의사항
                            </div>
                            <div style={{ fontSize: 14, color: '#666', lineHeight: 1.5, marginBottom: 16 }}>
                              회원탈퇴 시 다음 데이터가 <strong>영구적으로 삭제</strong>됩니다:
                              <br />• 계정 정보 및 개인정보
                              <br />• 작성한 모든 채팅 메시지
                              <br />• 생성한 채팅방
                              <br />• 연결된 소셜 계정
                              <br />• 사용자 설정
                            </div>
                            <div style={{ fontSize: 14, color: '#f44336', fontWeight: 'bold' }}>
                              이 작업은 되돌릴 수 없습니다!
                            </div>
                          </div>
                          <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
                              회원탈퇴를 진행하려면 아래에 <strong>"DELETE_ACCOUNT"</strong>를 입력하세요:
                            </label>
                            <input
                              type="text"
                              className="settings-modal-input"
                              placeholder="DELETE_ACCOUNT"
                              value={deleteConfirmation}
                              onChange={e => setDeleteConfirmation(e.target.value)}
                              style={{ borderColor: deleteConfirmation === 'DELETE_ACCOUNT' ? '#4caf50' : '#f44336' }}
                            />
                          </div>
                          {deleteError && (
                            <div style={{ color: 'red', marginBottom: 16, textAlign: 'center' }}>
                              {deleteError}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 12 }}>
                            <button
                              className="settings-modal-button"
                              style={{ flex: 1, background: '#666' }}
                              onClick={() => { setShowDeleteConfirmModal(false); setDeleteConfirmation(''); setDeleteError(null); }}
                              disabled={deleteLoading}
                            >
                              취소
                            </button>
                            <button
                              className="settings-modal-button"
                              style={{ flex: 1, background: '#f44336' }}
                              onClick={handleDeleteAccount}
                              disabled={deleteLoading || deleteConfirmation !== 'DELETE_ACCOUNT'}
                            >
                              {deleteLoading ? '처리 중...' : '회원탈퇴'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
          {tab === 'tts' && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!userSettings?.tts_enabled}
                  onChange={e => { setIsTTSEnabled(e.target.checked); saveSetting({ tts_enabled: e.target.checked }); }}
                  disabled={saving}
                />
                TTS 사용
              </label>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                <label htmlFor="tts-rate-select-modal">속도: </label>
                <select
                  id="tts-rate-select-modal"
                  value={userSettings?.tts_speed || 1.5}
                  onChange={e => { setTtsRate(parseFloat(e.target.value)); saveSetting({ tts_speed: parseFloat(e.target.value) }); }}
                  disabled={saving}
                  style={{ width: 80 }}
                >
                  {[1.0, 1.2, 1.5, 1.7, 2.0].map(rate => (
                    <option key={rate} value={rate}>{rate}</option>
                  ))}
                </select>
                <label htmlFor="tts-pitch-select-modal">음조: </label>
                <select
                  id="tts-pitch-select-modal"
                  value={userSettings?.tts_pitch || 1.5}
                  onChange={e => { setTtsPitch(parseFloat(e.target.value)); saveSetting({ tts_pitch: parseFloat(e.target.value) }); }}
                  disabled={saving}
                  style={{ width: 80 }}
                >
                  {[0.7, 1.0, 1.2, 1.5, 1.7, 2.0].map(pitch => (
                    <option key={pitch} value={pitch}>{pitch}</option>
                  ))}
                </select>
                <label htmlFor="tts-voice-select-modal">음성 선택: </label>
                <select
                  id="tts-voice-select-modal"
                  value={ttsVoice ? ttsVoice.name : ''}
                  onChange={e => {
                    const selected = voiceList.find(v => v.name === e.target.value);
                    setTtsVoice(selected);
                    saveSetting({ ttsVoice: selected?.name });
                  }}
                  disabled={saving}
                  style={{ width: 180 }}
                >
                  {safeVoiceList.length === 0 ? (
                    <option value="">음성 목록 로딩 중...</option>
                  ) : (
                    safeVoiceList.map((voice, idx) => (
                      <option key={voice.name + idx} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))
                  )}

                </select>
              </div>
            </div>
          )}
          {tab === 'voice' && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!userSettings?.voice_recognition_enabled}
                  onChange={e => { setIsVoiceRecognitionEnabled(e.target.checked); saveSetting({ voice_recognition_enabled: e.target.checked }); }}
                  disabled={saving}
                />
                음성인식 사용
              </label>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                <label htmlFor="auto-send-toggle-modal">자동전송: </label>
                <input
                  id="auto-send-toggle-modal"
                  type="checkbox"
                  checked={!!userSettings?.auto_send_enabled}
                  onChange={e => { setAutoSend(e.target.checked); saveSetting({ auto_send_enabled: e.target.checked }); }}
                  disabled={saving}
                />
                <button onClick={requestMicrophonePermission} disabled={saving} style={{ marginLeft: 12 }}>
                  마이크 권한 요청
                </button>
                <span style={{ marginLeft: 8, fontSize: 13, color: permissionStatus === 'granted' ? 'limegreen' : permissionStatus === 'denied' ? 'red' : '#aaa' }}>
                  권한: {permissionStatus}
                </span>
              </div>
              <div style={{ marginTop: 16 }}>
                <VoiceRecognition
                  ref={voiceRecognitionRef}
                  enabled={!!userSettings?.voice_recognition_enabled}
                  continuous={isContinuousRecognition}
                // onResult, onInterimResult 등은 상위에서 props로 넘겨야 함
                />
              </div>
            </div>
          )}
          {tab === 'camera' && (
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={!!userSettings?.camera_enabled}
                  onChange={e => { saveSetting({ camera_enabled: e.target.checked }); }}
                  disabled={saving}
                />
                카메라 사용
              </label>
            </div>
          )}
          {tab === 'avatar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!userSettings?.ai_avatar_enabled}
                  onChange={e => { saveSetting({ ai_avatar_enabled: e.target.checked }); }}
                  disabled={saving}
                />
                AI 아바타 사용
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!userSettings?.user_avatar_enabled}
                  onChange={e => { saveSetting({ user_avatar_enabled: e.target.checked }); }}
                  disabled={saving}
                />
                사용자 아바타 사용
              </label>
            </div>
          )}
          {tab === 'ai' && (
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={!!userSettings?.ai_response_enabled}
                  onChange={e => { saveSetting({ ai_response_enabled: e.target.checked }); }}
                  disabled={saving}
                />
                AI 응답 사용
              </label>
              <div style={{ marginTop: 12, fontSize: '0.9em', color: '#666' }}>
                AI 응답을 끄면 AI가 메시지에 응답하지 않습니다.
              </div>
            </div>
          )}
          {tab === 'notify' && <div>알림 설정 (예: 소리, 팝업 등)</div>}
          {tab === 'chat' && <div>채팅 설정</div>}
          {tab === 'display' && <div>화면 설정</div>}
          {tab === 'sound' && <div>소리 설정</div>}
          {tab === 'etc' && <div>기타 설정</div>}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal; 