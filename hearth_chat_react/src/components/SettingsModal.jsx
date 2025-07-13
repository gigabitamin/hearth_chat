import React, { useState } from 'react';
import './SettingsModal.css';

const tabList = [
  { key: 'tts', label: 'TTS' },
  { key: 'voice', label: '음성인식' },
  { key: 'camera', label: '카메라' },
  { key: 'avatar', label: '아바타' },
  { key: 'notify', label: '알림' },
  { key: 'etc', label: '기타' },
];

const SettingsModal = ({ isOpen, onClose, tab, setTab, userSettings, setUserSettings }) => {
  const [saving, setSaving] = useState(false);
  if (!isOpen) return null;

  // 서버에 설정 저장
  const saveSetting = async (patchObj) => {
    setSaving(true);
    try {
              // 환경에 따라 API URL 설정
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const apiUrl = isLocalhost ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`;
        
        const res = await fetch(`${apiUrl}/api/chat/user/settings/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchObj),
      });
      if (res.ok) {
        const data = await res.json();
        setUserSettings(data.settings || { ...userSettings, ...patchObj });
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
          {tab === 'tts' && (
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={!!userSettings?.ttsEnabled}
                  onChange={e => saveSetting({ ttsEnabled: e.target.checked })}
                  disabled={saving}
                />
                TTS 사용
              </label>
              <div style={{ marginTop: 12 }}>
                <label>속도: </label>
                <input
                  type="number"
                  min={0.5}
                  max={3}
                  step={0.05}
                  value={userSettings?.ttsRate ?? 1.5}
                  onChange={e => saveSetting({ ttsRate: parseFloat(e.target.value) })}
                  disabled={saving}
                  style={{ width: 60 }}
                />
              </div>
              <div style={{ marginTop: 12 }}>
                <label>음조: </label>
                <input
                  type="number"
                  min={0.5}
                  max={3}
                  step={0.05}
                  value={userSettings?.ttsPitch ?? 1.5}
                  onChange={e => saveSetting({ ttsPitch: parseFloat(e.target.value) })}
                  disabled={saving}
                  style={{ width: 60 }}
                />
              </div>
            </div>
          )}
          {tab === 'voice' && (
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={!!userSettings?.voiceRecognitionEnabled}
                  onChange={e => saveSetting({ voiceRecognitionEnabled: e.target.checked })}
                  disabled={saving}
                />
                음성인식 사용
              </label>
            </div>
          )}
          {tab === 'camera' && (
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={!!userSettings?.cameraActive}
                  onChange={e => saveSetting({ cameraActive: e.target.checked })}
                  disabled={saving}
                />
                카메라 사용
              </label>
            </div>
          )}
          {tab === 'avatar' && (
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={!!userSettings?.avatarOn}
                  onChange={e => saveSetting({ avatarOn: e.target.checked })}
                  disabled={saving}
                />
                아바타 사용
              </label>
            </div>
          )}
          {tab === 'notify' && <div>알림 설정 (예: 소리, 팝업 등)</div>}
          {tab === 'etc' && <div>기타 설정</div>}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal; 