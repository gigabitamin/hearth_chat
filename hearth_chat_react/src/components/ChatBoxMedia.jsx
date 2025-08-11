import React, { useState, useEffect, useRef, useCallback } from 'react';
import ttsService from '../services/ttsService';
import readyPlayerMeService from '../services/readyPlayerMe';
import faceTrackingService from '../services/faceTrackingService';
import { getApiBase, csrfFetch, API_BASE } from '../utils/apiConfig';

// 이미지 업로드 관련 함수들
export const useImageUpload = (selectedRoom, loginUser) => {
    const [attachedImages, setAttachedImages] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    const handleImageUpload = useCallback((e) => {
        const files = Array.from(e.target.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            alert('이미지 파일만 업로드 가능합니다.');
            return;
        }

        const newImages = imageFiles.map(file => ({
            file,
            preview: URL.createObjectURL(file),
            name: file.name
        }));

        setAttachedImages(prev => [...prev, ...newImages]);
    }, []);

    const handleRemoveAttachedImage = useCallback((index) => {
        setAttachedImages(prev => {
            const newImages = [...prev];
            URL.revokeObjectURL(newImages[index].preview);
            newImages.splice(index, 1);
            return newImages;
        });
    }, []);

    const handleRemoveAllAttachedImages = useCallback(() => {
        attachedImages.forEach(img => URL.revokeObjectURL(img.preview));
        setAttachedImages([]);
    }, [attachedImages]);

    const handleImageUploadAndSendWithFile = useCallback(async (imageFile, messageText) => {
        if (!imageFile || !selectedRoom || !loginUser) return;

        try {
            setIsUploading(true);

            const formData = new FormData();
            formData.append('image', imageFile);
            formData.append('room', selectedRoom.id);
            formData.append('sender', loginUser.username);
            if (messageText) {
                formData.append('content', messageText);
            }

            const response = await csrfFetch(`${getApiBase()}/api/chat/images/`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('이미지 업로드 실패');
            }

            return await response.json();
        } catch (error) {
            console.error('이미지 업로드 오류:', error);
            throw error;
        } finally {
            setIsUploading(false);
        }
    }, [selectedRoom, loginUser]);

    const handleMultipleImagesUploadAndSend = useCallback(async (messageText) => {
        if (attachedImages.length === 0) return;

        try {
            setIsUploading(true);

            for (const imageData of attachedImages) {
                await handleImageUploadAndSendWithFile(imageData.file, messageText);
            }

            // 업로드 완료 후 이미지 목록 초기화
            handleRemoveAllAttachedImages();
        } catch (error) {
            console.error('다중 이미지 업로드 오류:', error);
        } finally {
            setIsUploading(false);
        }
    }, [attachedImages, handleImageUploadAndSendWithFile, handleRemoveAllAttachedImages]);

    return {
        attachedImages,
        isUploading,
        handleImageUpload,
        handleRemoveAttachedImage,
        handleRemoveAllAttachedImages,
        handleImageUploadAndSendWithFile,
        handleMultipleImagesUploadAndSend
    };
};

// 음성 인식 관련 함수들
export const useVoiceRecognition = (loginUser) => {
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState(null);
    const [continuousRecognition, setContinuousRecognition] = useState(null);

    const startContinuousRecognition = useCallback(async () => {
        if (!('webkitSpeechRecognition' in window)) {
            alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
            return;
        }

        try {
            const recognition = new window.webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'ko-KR';

            recognition.onstart = () => {
                setIsListening(true);
                console.log('음성 인식 시작');
            };

            recognition.onresult = (event) => {
                let finalText = '';
                let interimText = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalText += transcript;
                    } else {
                        interimText += transcript;
                    }
                }

                if (finalText) {
                    // 최종 텍스트 처리
                    console.log('최종 인식 결과:', finalText);
                }
            };

            recognition.onerror = (event) => {
                console.error('음성 인식 오류:', event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
                console.log('음성 인식 종료');
            };

            setContinuousRecognition(recognition);
            recognition.start();
        } catch (error) {
            console.error('음성 인식 초기화 오류:', error);
        }
    }, []);

    const stopContinuousRecognition = useCallback(() => {
        if (continuousRecognition) {
            continuousRecognition.stop();
            setContinuousRecognition(null);
        }
    }, [continuousRecognition]);

    const handleVoiceRecognitionToggle = useCallback(async () => {
        if (isListening) {
            stopContinuousRecognition();
        } else {
            await startContinuousRecognition();
        }
    }, [isListening, startContinuousRecognition, stopContinuousRecognition]);

    return {
        isListening,
        handleVoiceRecognitionToggle,
        startContinuousRecognition,
        stopContinuousRecognition
    };
};

// TTS 관련 함수들
export const useTTS = () => {
    const [voices, setVoices] = useState([]);
    const [selectedVoice, setSelectedVoice] = useState(null);
    const [isSpeaking, setIsSpeaking] = useState(false);

    const initializeTTSService = useCallback(async () => {
        try {
            await ttsService.initialize();
            const availableVoices = await ttsService.getVoices();
            setVoices(availableVoices);

            if (availableVoices.length > 0) {
                setSelectedVoice(availableVoices[0]);
            }
        } catch (error) {
            console.error('TTS 초기화 오류:', error);
        }
    }, []);

    const speakAIMessage = useCallback(async (message) => {
        if (!message || !selectedVoice) return;

        try {
            // TTS가 이미 재생 중인지 확인
            if (!ttsService.isCurrentlySpeaking()) {
                setIsSpeaking(true);
                await ttsService.speak(message, selectedVoice);
            } else {
                console.log('TTS가 이미 재생 중입니다.');
            }
        } catch (error) {
            console.error('TTS 재생 오류:', error);
        } finally {
            setIsSpeaking(false);
        }
    }, [selectedVoice]);

    const stopSpeaking = useCallback(async () => {
        try {
            await ttsService.stop();
            setIsSpeaking(false);
        } catch (error) {
            console.error('TTS 정지 오류:', error);
        }
    }, []);

    useEffect(() => {
        initializeTTSService();
    }, [initializeTTSService]);

    return {
        voices,
        selectedVoice,
        setSelectedVoice,
        isSpeaking,
        speakAIMessage,
        stopSpeaking
    };
};

// 아바타 관련 함수들
export const useAvatars = (loginUser) => {
    const [avatars, setAvatars] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const initializeAvatars = useCallback(async () => {
        if (!loginUser) return;

        try {
            setIsLoading(true);

            // 사용자별 아바타 목록 가져오기
            const response = await csrfFetch(`${getApiBase()}/api/avatars/user/${loginUser.id}/`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                setAvatars(data);
            }
        } catch (error) {
            console.error('아바타 초기화 오류:', error);
        } finally {
            setIsLoading(false);
        }
    }, [loginUser]);

    const createAvatar = useCallback(async (avatarData) => {
        if (!loginUser) return;

        try {
            const response = await csrfFetch(`${getApiBase()}/api/avatars/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...avatarData,
                    user: loginUser.id
                })
            });

            if (response.ok) {
                const newAvatar = await response.json();
                setAvatars(prev => [...prev, newAvatar]);
                return newAvatar;
            }
        } catch (error) {
            console.error('아바타 생성 오류:', error);
            throw error;
        }
    }, [loginUser]);

    useEffect(() => {
        initializeAvatars();
    }, [initializeAvatars]);

    return {
        avatars,
        isLoading,
        createAvatar,
        initializeAvatars
    };
};

// 감정 분석 관련 함수들
export const useEmotionAnalysis = () => {
    const analyzeEmotion = useCallback((text) => {
        if (!text) return 'neutral';

        const positiveWords = ['좋아', '행복', '즐거워', '신나', '감사', '사랑', '기쁘', '웃겨'];
        const negativeWords = ['싫어', '슬퍼', '화나', '짜증', '답답', '불안', '걱정', '우울'];
        const excitedWords = ['대박', '와우', '놀라워', '엄청나', '멋져', '최고'];

        const lowerText = text.toLowerCase();

        let positiveCount = 0;
        let negativeCount = 0;
        let excitedCount = 0;

        positiveWords.forEach(word => {
            if (lowerText.includes(word)) positiveCount++;
        });

        negativeWords.forEach(word => {
            if (lowerText.includes(word)) negativeCount++;
        });

        excitedWords.forEach(word => {
            if (lowerText.includes(word)) excitedCount++;
        });

        if (excitedCount > 0) return 'excited';
        if (positiveCount > negativeCount) return 'happy';
        if (negativeCount > positiveCount) return 'sad';

        return 'neutral';
    }, []);

    return {
        analyzeEmotion,
        getAIEmotionResponse
    };
};

// getAIEmotionResponse를 별도로 export
export const getAIEmotionResponse = (userEmotion, aiMessage) => {
    const emotionResponses = {
        happy: '😊 사용자가 기분이 좋아 보이네요! 더 즐거운 대화를 나눠봐요.',
        sad: '😔 마음이 아픈 것 같아요. 이야기를 들어드릴게요.',
        excited: '🎉 와! 정말 신나는 일이 있나 봐요!',
        neutral: '😐 차분한 상태로 대화를 이어가고 있네요.'
    };

    return emotionResponses[userEmotion] || '대화를 계속 이어가봐요!';
};

// 비디오/카메라 관련 함수들
export const useVideoCamera = () => {
    const [localStream, setLocalStream] = useState(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isAudioActive, setIsAudioActive] = useState(true);

    const initializeLocalStream = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            setLocalStream(stream);
            setIsCameraActive(true);
            return stream;
        } catch (error) {
            console.error('미디어 스트림 초기화 오류:', error);
            throw error;
        }
    }, []);

    const toggleLocalVideo = useCallback(() => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraActive(videoTrack.enabled);
            }
        }
    }, [localStream]);

    const toggleLocalAudio = useCallback(() => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioActive(audioTrack.enabled);
            }
        }
    }, [localStream]);

    const stopLocalStream = useCallback(() => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
            setIsCameraActive(false);
            setIsAudioActive(false);
        }
    }, [localStream]);

    useEffect(() => {
        return () => {
            stopLocalStream();
        };
    }, [stopLocalStream]);

    return {
        localStream,
        isCameraActive,
        isAudioActive,
        initializeLocalStream,
        toggleLocalVideo,
        toggleLocalAudio,
        stopLocalStream
    };
};

// 파일 존재 여부 확인 함수들
export const checkFileExists = async (relPath) => {
    try {
        const response = await fetch(`${API_BASE}${relPath}`, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        return false;
    }
};

export const listMediaFiles = async () => {
    try {
        const response = await fetch(`${API_BASE}/api/media/files/`);
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('미디어 파일 목록 조회 오류:', error);
        return [];
    }
};

// TTS 관련 함수들
export const speakAIMessage = (message, setTtsInterrupted = null, userSettings = null) => {
    // TTS 설정 확인 - TTS가 비활성화되어 있으면 실행하지 않음
    if (userSettings && userSettings.tts_enabled === false) {
        console.log('[TTS] TTS가 비활성화되어 있어 메시지를 읽지 않습니다.');
        return;
    }

    // TTS로 AI 메시지 읽기 - 안전한 호출
    if (ttsService && message && typeof message === 'string' && message.trim()) {
        try {
            // TTS가 이미 재생 중인지 확인
            if (!ttsService.isCurrentlySpeaking()) {
                // TTS 중단 상태 해제
                if (setTtsInterrupted) {
                    setTtsInterrupted(false);
                }

                // TTS 설정값 준비
                const ttsOptions = {};
                if (userSettings) {
                    if (userSettings.tts_speed !== undefined) {
                        ttsOptions.rate = userSettings.tts_speed;
                        console.log('[TTS] 속도 설정 적용:', userSettings.tts_speed);
                    }
                    if (userSettings.tts_pitch !== undefined) {
                        ttsOptions.pitch = userSettings.tts_pitch;
                        console.log('[TTS] 음조 설정 적용:', userSettings.tts_pitch);
                    }
                    if (userSettings.tts_voice !== undefined) {
                        ttsOptions.voice = userSettings.tts_voice;
                        console.log('[TTS] 음성 설정 적용:', userSettings.tts_voice);
                    }
                }

                ttsService.speak(message.trim(), ttsOptions).catch(error => {
                    console.warn('TTS 재생 실패:', error.message);
                });
            } else {
                console.log('TTS가 이미 재생 중입니다.');
            }
        } catch (error) {
            console.warn('TTS 호출 중 오류:', error.message);
        }
    } else {
        console.log('TTS 재생을 건너뜁니다:', message ? '메시지 없음' : 'TTS 서비스 없음');
    }
};

// TTS 중단 상태 설정 함수
export const setTTSInterrupted = (setTtsInterrupted, interrupted) => {
    if (setTtsInterrupted) {
        setTtsInterrupted(interrupted);
        console.log('[TTS] TTS 중단 상태 설정:', interrupted);
    }
};

export const initializeTTSService = () => {
    // TTS 서비스 초기화 - ttsService는 이미 생성자에서 자동 초기화됨
    if (ttsService && ttsService.isSupported()) {
        console.log('TTS 서비스가 지원됩니다.');
    } else {
        console.warn('TTS 서비스가 지원되지 않습니다.');
    }
};

// 아바타 관련 함수들
export const initializeAvatars = () => {
    // 아바타 초기화 - readyPlayerMeService는 이미 생성자에서 초기화됨
    if (readyPlayerMeService) {
        console.log('ReadyPlayerMe 서비스가 준비되었습니다.');
    } else {
        console.warn('ReadyPlayerMe 서비스가 준비되지 않았습니다.');
    }
};

export const getAiAvatarStyle = (isCameraActive, isAiAvatarOn, isUserAvatarOn) => {
    return {
        position: 'absolute',
        top: '10%',
        left: '10%',
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        border: '3px solid #4ECDC4',
        backgroundColor: isAiAvatarOn ? '#4ECDC4' : 'transparent',
        display: isCameraActive && isAiAvatarOn ? 'block' : 'none',
        zIndex: 1000
    };
};

export const getUserAvatarStyle = (isCameraActive, isAiAvatarOn, isUserAvatarOn) => {
    return {
        position: 'absolute',
        top: '10%',
        right: '10%',
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        border: '3px solid #FF6B6B',
        backgroundColor: isUserAvatarOn ? '#FF6B6B' : 'transparent',
        display: isCameraActive && isUserAvatarOn ? 'block' : 'none',
        zIndex: 1000
    };
};

export const getCameraStyle = (isCameraActive, isAiAvatarOn, isUserAvatarOn) => {
    return {
        position: 'absolute',
        bottom: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '200px',
        height: '150px',
        border: '2px solid #333',
        borderRadius: '10px',
        display: isCameraActive ? 'block' : 'none',
        zIndex: 1000
    };
}; 