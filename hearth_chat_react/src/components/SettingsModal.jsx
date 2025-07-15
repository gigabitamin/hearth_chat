import React, { useState } from 'react';
import './SettingsModal.css';
import VoiceRecognition from './VoiceRecognition';

const tabList = [
  { key: 'user', label: '유저' },
  { key: 'network', label: '네트워크' },
  { key: 'tts', label: 'TTS' },
  { key: 'voice', label: '음성인식' },
  { key: 'camera', label: '카메라' },
  { key: 'avatar', label: '아바타' },
  { key: 'ai', label: 'AI 응답' },
  { key: 'notify', label: '알림' },
  { key: 'chat', label: '채팅' },
  { key: 'display', label: '화면' },
  { key: 'sound', label: '소리' },
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
  userInfo, // 추가: 유저 정보(이메일, 닉네임 등)
  onDeleteAccount, // 추가: 회원탈퇴 API 호출 함수
  wsConnected, // 추가: WebSocket 연결 상태
}) => {
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false); // 회원탈퇴 확인 모달
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
          <h2>설정</h2>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div><b>이메일:</b> {userInfo?.email || '로그인 필요'}</div>
              <div><b>닉네임:</b> {userInfo?.username || '-'}</div>
              {/* 기타 유저 정보 표시 가능 */}
              <button
                style={{ marginTop: 24, background: '#f44336', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setShowDeleteModal(true)}
                disabled={!onDeleteAccount}
              >
                회원탈퇴
              </button>
              {showDeleteModal && (
                <div className="settings-modal-overlay" style={{ zIndex: 1001 }}>
                  <div className="settings-modal" style={{ maxWidth: 340, textAlign: 'center' }}>
                    <h3>정말로 탈퇴하시겠습니까?</h3>
                    <p style={{ color: '#888', margin: '16px 0' }}>탈퇴 시 모든 데이터가 삭제됩니다.</p>
                    <button
                      style={{ background: '#f44336', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600, marginRight: 8, cursor: 'pointer' }}
                      onClick={() => { setShowDeleteModal(false); onDeleteAccount && onDeleteAccount(); }}
                      disabled={!onDeleteAccount}
                    >
                      네, 탈퇴할래요
                    </button>
                    <button
                      style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => setShowDeleteModal(false)}
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === 'network' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 18 }}>
              <span>실시간 연결 상태:</span>
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: wsConnected ? 'limegreen' : 'red', display: 'inline-block', marginRight: 8, border: '1.5px solid #888' }} />
              <span style={{ color: wsConnected ? 'limegreen' : 'red', fontWeight: 600 }}>{wsConnected ? '연결됨' : '끊김'}</span>
              {!wsConnected && <span style={{ color: '#888', marginLeft: 8, fontSize: 14 }}>(서버 또는 네트워크 문제)</span>}
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
                  value={userSettings?.tts_pitch || 1.0}
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
                  {voiceList.length === 0 ? (
                    <option value="">음성 목록 로딩 중...</option>
                  ) : (
                    voiceList.map((voice, idx) => (
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