import React, { useState, useEffect } from 'react';
import './AISettingsModal.css';

const AISettingsModal = ({ isOpen, onClose, onSave, currentSettings = {}, onActiveModelChange }) => {
    console.log('🔧 AISettingsModal - currentSettings:', currentSettings);

    const [settings, setSettings] = useState({
        aiEnabled: false,
        aiProvider: 'lily', // 'lily', 'chatgpt', 'gemini'
        lilyApiUrl: 'http://localhost:8001',
        lilyModel: 'polyglot-ko-1.3b-chat',
        chatgptApiKey: '',
        geminiApiKey: '',
        autoRespond: false,
        responseDelay: 1000,
        maxTokens: 1000,
        temperature: 0.7,
        ...currentSettings
    });

    console.log('🔧 AISettingsModal - 초기 settings:', settings);

    const [availableModels, setAvailableModels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [currentActiveModel, setCurrentActiveModel] = useState(null);

    // currentSettings가 변경될 때 settings 업데이트
    useEffect(() => {
        console.log('🔧 AISettingsModal - currentSettings 변경됨:', currentSettings);
        if (Object.keys(currentSettings).length > 0) {
            setSettings(prev => {
                const newSettings = {
                    aiEnabled: false,
                    aiProvider: 'lily',
                    lilyApiUrl: 'http://localhost:8001',
                    lilyModel: 'polyglot-ko-1.3b-chat',
                    chatgptApiKey: '',
                    geminiApiKey: '',
                    autoRespond: false,
                    responseDelay: 1000,
                    maxTokens: 1000,
                    temperature: 0.7,
                    ...currentSettings
                };
                console.log('🔧 AISettingsModal - 새로운 settings:', newSettings);
                return newSettings;
            });
        }
    }, [currentSettings]);

    // 모달이 열릴 때마다 현재 설정 확인
    useEffect(() => {
        if (isOpen) {
            console.log('🔧 AISettingsModal - 모달 열림, 현재 설정:', settings);
            console.log('🔧 AISettingsModal - aiProvider:', settings.aiProvider);
        }
    }, [isOpen, settings]);

    // 현재 활성화된 모델 정보를 부모 컴포넌트로 전달
    useEffect(() => {
        if (currentActiveModel && onActiveModelChange) {
            onActiveModelChange(currentActiveModel);
        }
    }, [currentActiveModel, onActiveModelChange]);

    // Lily API 모델 목록 가져오기
    useEffect(() => {
        if (isOpen && settings.aiProvider === 'lily') {
            fetchLilyModels();
        }
    }, [isOpen, settings.aiProvider]);

    const fetchLilyModels = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${settings.lilyApiUrl}/models`);
            if (response.ok) {
                const data = await response.json();
                setAvailableModels(data.models || []);

                // 현재 활성화된 모델 정보 가져오기
                if (data.current_model) {
                    console.log('🔧 AISettingsModal - 현재 활성화된 모델:', data.current_model);
                    setCurrentActiveModel(data.current_model);

                    // 현재 활성화된 모델로 설정 업데이트
                    setSettings(prev => ({
                        ...prev,
                        lilyModel: data.current_model.model_id || prev.lilyModel
                    }));
                }
            }
        } catch (error) {
            console.error('Lily API 모델 목록 가져오기 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field, value) => {
        console.log('🔧 AISettingsModal - 입력 변경:', field, value);
        setSettings(prev => {
            const newSettings = {
                ...prev,
                [field]: value
            };
            console.log('🔧 AISettingsModal - 새로운 설정:', newSettings);
            return newSettings;
        });
    };

    const testAIConnection = async () => {
        try {
            setLoading(true);
            setTestResult(null);

            let testUrl = '';
            let testData = {};

            switch (settings.aiProvider) {
                case 'lily':
                    testUrl = `${settings.lilyApiUrl}/health`;
                    break;
                case 'chatgpt':
                    testUrl = 'https://api.openai.com/v1/models';
                    testData = {
                        headers: {
                            'Authorization': `Bearer ${settings.chatgptApiKey}`
                        }
                    };
                    break;
                case 'gemini':
                    testUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
                    testData = {
                        headers: {
                            'Authorization': `Bearer ${settings.geminiApiKey}`
                        }
                    };
                    break;
            }

            const response = await fetch(testUrl, testData);

            if (response.ok) {
                setTestResult({
                    success: true,
                    message: `${settings.aiProvider.toUpperCase()} API 연결 성공!`
                });
            } else {
                setTestResult({
                    success: false,
                    message: `${settings.aiProvider.toUpperCase()} API 연결 실패: ${response.status}`
                });
            }
        } catch (error) {
            setTestResult({
                success: false,
                message: `${settings.aiProvider.toUpperCase()} API 연결 오류: ${error.message}`
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = () => {
        console.log('💾 AISettingsModal - 설정 저장 시작');
        console.log('💾 AISettingsModal - 현재 설정:', settings);
        console.log('💾 AISettingsModal - onSave 함수 호출');
        onSave(settings);
        console.log('💾 AISettingsModal - onClose 함수 호출');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="ai-settings-modal-overlay" onClick={(e) => {
            // 오버레이 클릭 시에만 모달 닫기
            if (e.target === e.currentTarget) {
                onClose();
            }
        }}>
            <div className="ai-settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ai-settings-modal-header">
                    <h2>🤖 AI 설정</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <div className="ai-settings-modal-content">
                    {/* AI 활성화 */}
                    <div className="setting-group">
                        <label className="setting-label">
                            <input
                                type="checkbox"
                                checked={settings.aiEnabled}
                                onChange={(e) => handleInputChange('aiEnabled', e.target.checked)}
                            />
                            AI 자동 응답 활성화
                        </label>
                    </div>

                    {/* AI 제공자 선택 */}
                    <div className="setting-group">
                        <label className="setting-label">AI 제공자:</label>
                        <select
                            value={settings.aiProvider}
                            onChange={(e) => handleInputChange('aiProvider', e.target.value)}
                        >
                            <option value="lily">Lily LLM (로컬)</option>
                            <option value="chatgpt">ChatGPT (OpenAI)</option>
                            <option value="gemini">Gemini (Google)</option>
                        </select>
                    </div>

                    {/* Lily API 설정 */}
                    {settings.aiProvider === 'lily' && (
                        <>
                            <div className="setting-group">
                                <label className="setting-label">Lily API URL:</label>
                                <input
                                    type="text"
                                    value={settings.lilyApiUrl}
                                    onChange={(e) => handleInputChange('lilyApiUrl', e.target.value)}
                                    placeholder="http://localhost:8001"
                                />
                            </div>

                            <div className="setting-group">
                                <label className="setting-label">모델 선택:</label>
                                <select
                                    value={settings.lilyModel}
                                    onChange={(e) => handleInputChange('lilyModel', e.target.value)}
                                    disabled={loading}
                                >
                                    {availableModels.map(model => (
                                        <option key={model.model_id} value={model.model_id}>
                                            {model.display_name}
                                        </option>
                                    ))}
                                </select>

                                {/* 현재 활성화된 모델 정보 표시 */}
                                {currentActiveModel && (
                                    <div className="current-model-info">
                                        <small style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                                            ✅ 현재 활성화된 모델: {currentActiveModel.display_name}
                                        </small>
                                        {currentActiveModel.model_id !== settings.lilyModel && (
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
                    {settings.aiProvider === 'chatgpt' && (
                        <div className="setting-group">
                            <label className="setting-label">OpenAI API Key:</label>
                            <input
                                type="password"
                                value={settings.chatgptApiKey}
                                onChange={(e) => handleInputChange('chatgptApiKey', e.target.value)}
                                placeholder="sk-..."
                            />
                        </div>
                    )}

                    {/* Gemini API 설정 */}
                    {settings.aiProvider === 'gemini' && (
                        <div className="setting-group">
                            <label className="setting-label">Gemini API Key:</label>
                            <input
                                type="password"
                                value={settings.geminiApiKey}
                                onChange={(e) => handleInputChange('geminiApiKey', e.target.value)}
                                placeholder="AIza..."
                            />
                        </div>
                    )}

                    {/* 응답 설정 */}
                    <div className="setting-group">
                        <label className="setting-label">
                            <input
                                type="checkbox"
                                checked={settings.autoRespond}
                                onChange={(e) => handleInputChange('autoRespond', e.target.checked)}
                            />
                            자동 응답 활성화
                        </label>
                    </div>

                    <div className="setting-group">
                        <label className="setting-label">응답 지연 시간 (ms):</label>
                        <input
                            type="number"
                            value={settings.responseDelay}
                            onChange={(e) => handleInputChange('responseDelay', parseInt(e.target.value))}
                            min="0"
                            max="10000"
                        />
                    </div>

                    <div className="setting-group">
                        <label className="setting-label">최대 토큰 수:</label>
                        <input
                            type="number"
                            value={settings.maxTokens}
                            onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value))}
                            min="1"
                            max="4000"
                        />
                    </div>

                    <div className="setting-group">
                        <label className="setting-label">창의성 (Temperature):</label>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={settings.temperature}
                            onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                        />
                        <span>{settings.temperature}</span>
                    </div>

                    {/* 연결 테스트 */}
                    <div className="setting-group">
                        <button
                            className="test-button"
                            onClick={testAIConnection}
                            disabled={loading}
                        >
                            {loading ? '테스트 중...' : 'API 연결 테스트'}
                        </button>

                        {testResult && (
                            <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                                {testResult.message}
                            </div>
                        )}
                    </div>
                </div>

                <div className="ai-settings-modal-footer">
                    <button className="cancel-button" onClick={onClose}>
                        취소
                    </button>
                    <button
                        className="save-button"
                        onClick={() => {
                            console.log('🔘 AISettingsModal - 저장 버튼 클릭됨');
                            handleSave();
                        }}
                    >
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AISettingsModal; 