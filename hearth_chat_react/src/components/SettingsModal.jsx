import React, { useState, useEffect } from 'react';
import './SettingsModal.css';
import VoiceRecognition from './VoiceRecognition';
import { API_BASE, LILY_API_URL } from '../utils/apiConfig';

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

  // AI 설정 관련 상태
  const [aiSettings, setAiSettings] = useState({
    aiEnabled: !!userSettings?.ai_response_enabled,
    aiProvider: 'lily',
    lilyApiUrl: LILY_API_URL,
    lilyModel: 'kanana-1.5-v-3b-instruct',
    chatgptApiKey: '',
    geminiApiKey: '',
    autoRespond: false,
    responseDelay: 1000,
    maxTokens: 1000,
    temperature: 0.7,
    availableModels: [],
    ...(userSettings?.ai_settings ? JSON.parse(userSettings.ai_settings) : {})
  });
  const [currentActiveModel, setCurrentActiveModel] = useState(null);

  // Lily API 모델 목록 가져오기
  const fetchLilyModels = async () => {
    try {
      const response = await fetch(`${aiSettings.lilyApiUrl}/models`);
      if (response.ok) {
        const data = await response.json();
        setAiSettings(prev => ({ ...prev, availableModels: data.models || [] }));

        // 현재 활성화된 모델 정보 가져오기
        if (data.current_model) {
          console.log('🔧 SettingsModal - 현재 활성화된 모델:', data.current_model);
          setCurrentActiveModel(data.current_model);

          // 현재 활성화된 모델로 설정 업데이트
          setAiSettings(prev => ({
            ...prev,
            lilyModel: data.current_model.model_id || prev.lilyModel
          }));
        }
      }
    } catch (error) {
      console.error('Lily API 모델 목록 가져오기 실패:', error);
    }
  };

  // userSettings에서 AI 설정 로드
  useEffect(() => {
    if (userSettings) {

      let newAiSettings = {
        aiEnabled: !!userSettings.ai_response_enabled,
        aiProvider: 'lily',
        lilyApiUrl: LILY_API_URL,
        lilyModel: 'kanana-1.5-v-3b-instruct',
        chatgptApiKey: '',
        geminiApiKey: '',
        autoRespond: false,
        responseDelay: 1000,
        maxTokens: 1000,
        temperature: 0.7,
        availableModels: []
      };

      // 저장된 AI 설정이 있으면 파싱
      if (userSettings.ai_settings) {
        try {
          const savedSettings = JSON.parse(userSettings.ai_settings);
          newAiSettings = { ...newAiSettings, ...savedSettings };
        } catch (e) {
          console.error('❌ SettingsModal - AI 설정 파싱 실패:', e);
        }
      }
      setAiSettings(newAiSettings);

    }
  }, [userSettings]);

  // AI 제공자가 lily일 때 모델 목록 가져오기
  useEffect(() => {
    if (aiSettings.aiProvider === 'lily' && aiSettings.lilyApiUrl) {
      fetchLilyModels();
    }
  }, [aiSettings.aiProvider, aiSettings.lilyApiUrl]);

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

    const popup = window.open(
      `${API_BASE}/oauth/${provider}/connect/`,
      'social_connect',
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );

    if (!popup) {
      alert('팝업창이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
      return;
    }

    // 팝업창이 닫혔는지 모니터링
    const checkPopupClosed = setInterval(() => {
      if (popup.closed) {
        console.log('[SettingsModal] 팝업창이 닫힘 - 모달 닫기');
        clearInterval(checkPopupClosed);
        // 팝업이 닫히면 모달도 닫기
        onClose();
      }
    }, 1000);
  };

  // 유저 정보 로드
  useEffect(() => {
    if (isOpen && tab === 'user') {

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

      // 연결된 계정 목록 갱신
      fetchConnections();
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
    console.log('💾 SettingsModal - 설정 저장 시작:', patchObj);
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
        ai_settings: 'ai_settings',  // AI 설정 필드 추가
        face_tracking_enabled: 'face_tracking_enabled',  // 얼굴 트래킹 필드 추가
        auto_tracking_enabled: 'auto_tracking_enabled', // 자동 트래킹 필드 추가
        tracking_sensitivity: 'tracking_sensitivity', // 트래킹 민감도 필드 추가
        tracking_smoothness: 'tracking_smoothness', // 트래킹 부드러움 필드 추가
        tracking_camera_index: 'tracking_camera_index', // 트래킹 카메라 인덱스 필드 추가
      };
      // 매핑 적용
      const serverPatch = {};
      Object.entries(patchObj).forEach(([k, v]) => {
        const mappedKey = keyMap[k] || k;
        serverPatch[mappedKey] = v;
      });

      console.log('💾 SettingsModal - 서버에 전송할 데이터:', serverPatch);

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

      console.log('💾 SettingsModal - 서버 응답 상태:', res.status);

      if (res.ok) {
        const data = await res.json();
        console.log('💾 SettingsModal - 서버 응답 데이터:', data);

        // 서버 응답과 로컬 상태 동기화
        const updatedSettings = data.settings || { ...userSettings, ...serverPatch };
        setUserSettings(updatedSettings);

        // 로컬 상태도 서버 응답으로 업데이트
        if (serverPatch.tts_speed !== undefined) {
          setTtsRate(serverPatch.tts_speed);
        }
        if (serverPatch.tts_pitch !== undefined) {
          setTtsPitch(serverPatch.tts_pitch);
        }
        if (serverPatch.tts_voice !== undefined) {
          const selectedVoice = voiceList.find(v => v.name === serverPatch.tts_voice);
          setTtsVoice(selectedVoice);
        }

        console.log('✅ SettingsModal - 설정 저장 성공, 로컬 상태 동기화 완료');
      } else {
        console.error('❌ SettingsModal - 설정 저장 실패:', res.status, res.statusText);
      }
    } catch (error) {
      console.error('❌ SettingsModal - 설정 저장 중 오류:', error);
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
            <div style={{ position: 'relative' }}>
              {/* 관리자 대시보드 버튼 (관리자만) */}
              {user && user.is_staff && (
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  title="관리자 대시보드"
                  style={{ position: 'absolute', top: 0, right: 0, background: '#888', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: 16, zIndex: 2 }}
                >
                  <span role="img" aria-label="admin">👑</span> 관리자
                </button>
              )}
              {/* 기존 유저 정보/버튼 영역 */}
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

                    <div className="settings-modal-button-list-container" style={{ display: 'flex', justifyContent: 'center' }}>
                      <ul className="settings-modal-button-list">
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
                            style={{ width: '100%', background: '#bbc', color: '#333' }}
                            onClick={handleLogout}
                            disabled={logoutLoading}
                          >
                            {logoutLoading ? '로그아웃 중...' : '로그아웃'}
                          </button>
                        </li>
                        <li>
                          <button
                            className="settings-modal-button"
                            style={{ width: '100%', background: '#fe11', color: '#fff' }}
                            onClick={() => setShowDeleteConfirmModal(true)}
                          >
                            회원탈퇴
                          </button>
                        </li>
                      </ul>
                    </div>

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
                  value={ttsRate || userSettings?.tts_speed || 1.5}
                  onChange={e => {
                    const newRate = parseFloat(e.target.value);
                    console.log('🎯 TTS 속도 변경:', newRate);
                    setTtsRate(newRate);
                    saveSetting({ tts_speed: newRate });
                  }}
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
                  value={ttsPitch || userSettings?.tts_pitch || 1.5}
                  onChange={e => {
                    const newPitch = parseFloat(e.target.value);
                    console.log('🎯 TTS 음조 변경:', newPitch);
                    setTtsPitch(newPitch);
                    saveSetting({ tts_pitch: newPitch });
                  }}
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
                  value={ttsVoice ? ttsVoice.name : userSettings?.tts_voice || ''}
                  onChange={e => {
                    const selected = voiceList.find(v => v.name === e.target.value);
                    setTtsVoice(selected);
                    saveSetting({ tts_voice: selected?.name });
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!userSettings?.camera_enabled}
                  onChange={e => { saveSetting({ camera_enabled: e.target.checked }); }}
                  disabled={saving}
                />
                카메라 사용
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!userSettings?.face_tracking_enabled}
                  onChange={e => {
                    console.log('[설정] 얼굴 트래킹 체크박스 변경:', e.target.checked);
                    saveSetting({ face_tracking_enabled: e.target.checked });
                  }}
                  disabled={saving}
                />
                얼굴 트래킹 사용
              </label>

              {userSettings?.face_tracking_enabled && (
                <div style={{ marginLeft: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={!!userSettings?.auto_tracking_enabled}
                      onChange={e => { saveSetting({ auto_tracking_enabled: e.target.checked }); }}
                      disabled={saving}
                    />
                    자동 트래킹 활성화
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: '0.9em', fontWeight: '500' }}>
                      트래킹 민감도: {userSettings?.tracking_sensitivity || 0.5}
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.1"
                      value={userSettings?.tracking_sensitivity || 0.5}
                      onChange={e => { saveSetting({ tracking_sensitivity: parseFloat(e.target.value) }); }}
                      style={{ width: '100%' }}
                      disabled={saving}
                    />
                    <small style={{ fontSize: '0.8em', color: '#666' }}>
                      낮음 (0.1) - 높음 (1.0)
                    </small>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: '0.9em', fontWeight: '500' }}>
                      트래킹 부드러움: {userSettings?.tracking_smoothness || 0.3}
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="0.8"
                      step="0.1"
                      value={userSettings?.tracking_smoothness || 0.3}
                      onChange={e => { saveSetting({ tracking_smoothness: parseFloat(e.target.value) }); }}
                      style={{ width: '100%' }}
                      disabled={saving}
                    />
                    <small style={{ fontSize: '0.8em', color: '#666' }}>
                      부드러움 (0.1) - 정확함 (0.8)
                    </small>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: '0.9em', fontWeight: '500' }}>
                      트래킹 카메라 인덱스: {userSettings?.tracking_camera_index || 0}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={userSettings?.tracking_camera_index || 0}
                      onChange={e => { saveSetting({ tracking_camera_index: parseInt(e.target.value) }); }}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.9em',
                        width: '100px'
                      }}
                      disabled={saving}
                    />
                    <small style={{ fontSize: '0.8em', color: '#666' }}>
                      사용할 카메라의 인덱스 (0부터 시작)
                    </small>
                  </div>
                </div>
              )}

              <div style={{ marginLeft: 20, fontSize: '0.9em', color: '#666' }}>
                <p>얼굴 트래킹을 활성화하면:</p>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>사용자 아바타가 실제 얼굴 움직임을 따라합니다</li>
                  <li>입 모양, 눈 깜빡임, 고개 회전이 실시간으로 반영됩니다</li>
                  <li>웹캠 권한이 필요합니다</li>
                </ul>
              </div>
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

              {userSettings?.ai_avatar_enabled && (
                <div style={{ marginLeft: 20 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: '0.9em', fontWeight: '500' }}>AI 아바타 URL:</span>
                    <input
                      type="text"
                      value={userSettings?.ai_avatar_url || ''}
                      onChange={e => { saveSetting({ ai_avatar_url: e.target.value }); }}
                      placeholder="/avatar_vrm/gb_f_v2.vrm"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.9em'
                      }}
                      disabled={saving}
                    />
                    <small style={{ fontSize: '0.8em', color: '#666' }}>
                      기본값: /avatar_vrm/gb_f_v2.vrm
                    </small>
                  </label>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!userSettings?.user_avatar_enabled}
                  onChange={e => { saveSetting({ user_avatar_enabled: e.target.checked }); }}
                  disabled={saving}
                />
                사용자 아바타 사용
              </label>

              {userSettings?.user_avatar_enabled && (
                <div style={{ marginLeft: 20 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: '0.9em', fontWeight: '500' }}>사용자 아바타 URL:</span>
                    <input
                      type="text"
                      value={userSettings?.user_avatar_url || ''}
                      onChange={e => { saveSetting({ user_avatar_url: e.target.value }); }}
                      placeholder="/avatar_vrm/gb_m_v2.vrm"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.9em'
                      }}
                      disabled={saving}
                    />
                    <small style={{ fontSize: '0.8em', color: '#666' }}>
                      기본값: /avatar_vrm/gb_m_v2.vrm
                    </small>
                  </label>
                </div>
              )}
            </div>
          )}
          {tab === 'ai' && (
            <div>

              {/* 응답 설정 */}
              <div className="setting-group">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={aiSettings.autoRespond}
                    onChange={(e) => setAiSettings(prev => ({ ...prev, autoRespond: e.target.checked }))}
                    disabled={saving}
                  />
                  자동 응답 활성화
                </label>
              </div>

              {/* AI 활성화 */}
              {/* <div className="setting-group">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={aiSettings.aiEnabled}
                    onChange={(e) => {
                      setAiSettings(prev => ({ ...prev, aiEnabled: e.target.checked }));
                      saveSetting({ ai_response_enabled: e.target.checked });
                    }}
                    disabled={saving}
                  />
                  AI 자동 응답 활성화
                </label>
              </div> */}

              {/* AI 제공자 선택 */}
              <div className="setting-group">
                <label className="setting-label">AI 제공자:</label>
                <select
                  value={aiSettings.aiProvider}
                  onChange={(e) => setAiSettings(prev => ({ ...prev, aiProvider: e.target.value }))}
                  disabled={saving}
                >
                  <option value="lily">Lily Fast Api</option>
                  <option value="gemini">Gemini (Google)</option>
                  {/* <option value="chatgpt">ChatGPT (OpenAI)</option> */}
                  {/* <option value="huggingface">Lily Gradio</option> */}
                </select>
              </div>

              {/* Lily API 설정 */}
              {aiSettings.aiProvider === 'lily' && (
                <>
                  <div className="setting-group">
                    <label className="setting-label">Lily API URL:</label>
                    <input
                      type="text"
                      value={aiSettings.lilyApiUrl}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, lilyApiUrl: e.target.value }))}
                      placeholder="http://localhost:8001"
                      disabled={saving}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.9em',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div className="setting-group">
                    <label className="setting-label">모델 선택:</label>
                    <select
                      value={aiSettings.lilyModel}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, lilyModel: e.target.value }))}
                      disabled={saving}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.9em',
                        width: '100%'
                      }}
                    >
                      {aiSettings.availableModels?.map(model => (
                        <option key={model.model_id} value={model.model_id}>
                          {model.model_id}
                        </option>
                      )) || []}
                    </select>

                    {/* 현재 활성화된 모델 정보 표시 */}
                    {currentActiveModel && (
                      <div className="current-model-info" style={{ marginTop: '8px' }}>
                        <small style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                          ✅ 현재 활성화된 모델: {currentActiveModel.display_name}
                        </small>
                        {currentActiveModel.display_name !== aiSettings.lilyModel && (
                          <small style={{ color: '#FF9800', display: 'block', marginTop: '4px' }}>
                            ⚠️ 선택된 모델과 서버의 활성 모델이 다릅니다
                          </small>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ChatGPT API 설정 */}
              {aiSettings.aiProvider === 'chatgpt' && (
                <div className="setting-group">
                  <label className="setting-label">OpenAI API Key:</label>
                  <input
                    type="password"
                    value={aiSettings.chatgptApiKey}
                    onChange={(e) => setAiSettings(prev => ({ ...prev, chatgptApiKey: e.target.value }))}
                    placeholder="sk-..."
                    disabled={saving}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.9em',
                      width: '100%'
                    }}
                  />
                </div>
              )}

              {/* Hugging Face 설정 */}
              {aiSettings.aiProvider === 'huggingface' && (
                <div className="setting-group">
                  <label className="setting-label">Hugging Face 스페이스:</label>
                  <div style={{
                    padding: '10px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#666'
                  }}>
                    <strong>Kanana LLM (Hugging Face)</strong><br />
                    <small>스페이스 URL: https://gbrabbit-lily-math-rag.hf.space</small><br />
                    <small>모델: kanana-1.5-v-3b-instruct</small>
                  </div>
                </div>
              )}

              {/* Gemini API 설정 */}
              {aiSettings.aiProvider === 'gemini' && (
                <>
                  <div className="setting-group">
                    <label className="setting-label">Gemini API Key:</label>
                    <input
                      type="password"
                      value={aiSettings.geminiApiKey}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                      placeholder="AIza..."
                      disabled={saving}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.9em',
                        width: '100%'
                      }}
                    />
                  </div>

                  <div className="setting-group">
                    <label className="setting-label">Gemini 모델 선택:</label>
                    <select
                      value={aiSettings.geminiModel}
                      onChange={(e) => setAiSettings(prev => ({ ...prev, geminiModel: e.target.value }))}
                      disabled={saving}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.9em',
                        width: '100%'
                      }}
                    >
                      {[
                        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: '빠르고 다재다능한 멀티모달 모델' },
                        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '고성능 멀티모달 모델 (최대 200만 토큰)' },
                        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '최신 2.0 버전의 빠른 모델' },
                        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '최신 2.5 버전의 빠른 모델' },
                        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '최신 2.5 버전의 고성능 모델' }
                      ].map(model => (
                        <option key={model.id} value={model.id}>
                          {model.name} - {model.description}
                        </option>
                      ))}
                    </select>

                    {/* 선택된 모델 정보 표시 */}
                    {aiSettings.geminiModel && (
                      <div className="model-info" style={{ marginTop: '8px' }}>
                        <small style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                          ✅ 선택된 모델: {[
                            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: '빠르고 다재다능한 멀티모달 모델' },
                            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '고성능 멀티모달 모델 (최대 200만 토큰)' },
                            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '최신 2.0 버전의 빠른 모델' },
                            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '최신 2.5 버전의 빠른 모델' },
                            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '최신 2.5 버전의 고성능 모델' }
                          ].find(m => m.id === aiSettings.geminiModel)?.name}
                        </small>
                        <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                          {[
                            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: '빠르고 다재다능한 멀티모달 모델' },
                            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '고성능 멀티모달 모델 (최대 200만 토큰)' },
                            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '최신 2.0 버전의 빠른 모델' },
                            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '최신 2.5 버전의 빠른 모델' },
                            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: '최신 2.5 버전의 고성능 모델' }
                          ].find(m => m.id === aiSettings.geminiModel)?.description}
                        </small>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="setting-group">
                <label className="setting-label">응답 지연 시간 (ms):</label>
                <input
                  type="number"
                  value={aiSettings.responseDelay}
                  onChange={(e) => setAiSettings(prev => ({ ...prev, responseDelay: parseInt(e.target.value) }))}
                  min="0"
                  max="10000"
                  disabled={saving}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.9em',
                    width: '100%'
                  }}
                />
              </div>

              <div className="setting-group">
                <label className="setting-label">최대 토큰 수:</label>
                <input
                  type="number"
                  value={aiSettings.maxTokens}
                  onChange={(e) => setAiSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                  min="1"
                  max="4000"
                  disabled={saving}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.9em',
                    width: '100%'
                  }}
                />
              </div>

              <div className="setting-group">
                <label className="setting-label">창의성 (Temperature):</label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={aiSettings.temperature}
                  onChange={(e) => setAiSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  disabled={saving}
                  style={{ width: '100%' }}
                />
                <span>{aiSettings.temperature}</span>
              </div>

              {/* 연결 테스트 */}
              <div className="setting-group">
                <button
                  className="test-button"
                  onClick={async () => {
                    try {
                      setSaving(true);
                      let testUrl = '';
                      let testData = {};

                      switch (aiSettings.aiProvider) {
                        case 'lily':
                          testUrl = `${aiSettings.lilyApiUrl}/health`;
                          break;
                        case 'huggingface':
                          testUrl = 'https://gbrabbit-lily-math-rag.hf.space/api/predict';
                          testData = {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              data: [
                                "안녕하세요! 테스트 메시지입니다.",
                                "kanana-1.5-v-3b-instruct",
                                50,
                                0.7,
                                0.9,
                                1.0,
                                true
                              ]
                            })
                          };
                          break;
                        case 'chatgpt':
                          testUrl = 'https://api.openai.com/v1/models';
                          testData = {
                            headers: {
                              'Authorization': `Bearer ${aiSettings.chatgptApiKey}`
                            }
                          };
                          break;
                        case 'gemini':
                          testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${aiSettings.geminiModel}:generateContent`;
                          testData = {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'x-goog-api-key': aiSettings.geminiApiKey
                            },
                            body: JSON.stringify({
                              contents: [{
                                parts: [
                                  {
                                    text: "안녕하세요! 테스트 메시지입니다."
                                  }
                                ]
                              }],
                              generationConfig: {
                                maxOutputTokens: 50,
                                temperature: 0.7
                              }
                            })
                          };
                          break;
                      }

                      const response = await fetch(testUrl, testData);

                      if (response.ok) {
                        let resultMessage = `${aiSettings.aiProvider.toUpperCase()} API 연결 성공!`;

                        // 허깅페이스의 경우 응답 내용도 확인
                        if (aiSettings.aiProvider === 'huggingface') {
                          try {
                            const result = await response.json();
                            if (result.data && result.data[0]) {
                              resultMessage += `\n테스트 응답: ${result.data[0].substring(0, 100)}...`;
                            }
                          } catch (e) {
                            resultMessage += '\n(응답 파싱 실패)';
                          }
                        }

                        alert(resultMessage);
                      } else {
                        alert(`${aiSettings.aiProvider.toUpperCase()} API 연결 실패: ${response.status}`);
                      }
                    } catch (error) {
                      alert(`${aiSettings.aiProvider.toUpperCase()} API 연결 오류: ${error.message}`);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    width: '100%'
                  }}
                >
                  {saving ? '테스트 중...' : 'API 연결 테스트'}
                </button>
              </div>

              {/* 설정 저장 버튼 */}
              <div className="setting-group" style={{ marginTop: '20px' }}>
                <button
                  onClick={async () => {
                    try {
                      setSaving(true);
                      // AI 설정을 서버에 저장
                      const saveData = {
                        ai_response_enabled: aiSettings.aiEnabled,
                        ai_settings: JSON.stringify(aiSettings),
                        // 서버 DB 필드도 동기화하여 기본 제공자 추론이 어긋나지 않도록 함
                        ai_provider: aiSettings.aiProvider,
                        gemini_model: aiSettings.geminiModel,
                      };
                      console.log('🔧 SettingsModal - 서버에 저장할 데이터:', saveData);
                      console.log('🔧 SettingsModal - ai_settings JSON:', JSON.stringify(aiSettings));
                      await saveSetting(saveData);
                      alert('AI 설정이 저장되었습니다.');
                    } catch (error) {
                      console.error('AI 설정 저장 실패:', error);
                      alert('AI 설정 저장에 실패했습니다.');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg,rgb(193, 193, 193) 0%,rgb(193, 193, 193) 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '1em',
                    width: '100%'
                  }}
                >
                  {saving ? '저장 중...' : 'AI 설정 저장'}
                </button>
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