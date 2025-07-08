class TTSService {
    constructor() {
        // speechSynthesis 지원 확인
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            this.synthesis = window.speechSynthesis;
            this.isSupported = true;
        } else {
            this.synthesis = null;
            this.isSupported = false;
            console.warn('TTS가 지원되지 않는 브라우저입니다.');
        }

        this.utterance = null;
        this.isSpeaking = false;
        this.onSpeakStart = null;
        this.onSpeakEnd = null;
        this.onSpeakPause = null;
        this.onSpeakResume = null;
        this.onSpeakError = null;

        // 음성 설정
        this.voiceSettings = {
            rate: 1.0,        // 속도 (0.1 ~ 10)
            pitch: 1.0,       // 음조 (0 ~ 2)
            volume: 1.0,      // 볼륨 (0 ~ 1)
            voice: null       // 음성 (시스템에서 선택)
        };

        if (this.isSupported) {
            this.initializeVoice();
            // 전역 이벤트 리스너 추가
            this.setupGlobalEventListeners();
        }
    }

    // 음성 초기화
    initializeVoice() {
        if (!this.isSupported || !this.synthesis) {
            console.warn('TTS가 지원되지 않아 초기화를 건너뜁니다.');
            return;
        }

        try {
            // 음성 목록 로드 대기
            if (this.synthesis.onvoiceschanged !== undefined) {
                this.synthesis.onvoiceschanged = () => {
                    this.setDefaultVoice();
                };
            }

            // 기본 음성 설정
            this.setDefaultVoice();
        } catch (error) {
            console.error('TTS 초기화 중 오류 발생:', error);
            this.isSupported = false;
        }
    }

    // 기본 음성 설정
    setDefaultVoice() {
        if (!this.isSupported || !this.synthesis) {
            console.warn('TTS가 지원되지 않아 음성 설정을 건너뜁니다.');
            return;
        }

        try {
            const voices = this.synthesis.getVoices();

            // 한국어 음성 우선 선택
            let koreanVoice = voices.find(voice =>
                voice.lang.includes('ko') || voice.lang.includes('ko-KR')
            );

            // 한국어가 없으면 영어 음성 선택
            let englishVoice = voices.find(voice =>
                voice.lang.includes('en') || voice.lang.includes('en-US')
            );

            // 기본 음성 설정
            this.voiceSettings.voice = koreanVoice || englishVoice || voices[0];

            console.log('TTS 음성 설정:', {
                selectedVoice: this.voiceSettings.voice?.name,
                availableVoices: voices.length,
                koreanVoice: !!koreanVoice,
                englishVoice: !!englishVoice
            });
        } catch (error) {
            console.error('TTS 음성 설정 중 오류 발생:', error);
        }
    }

    // 음성 목록 가져오기
    getVoices() {
        if (!this.isSupported || !this.synthesis) {
            console.warn('TTS가 지원되지 않습니다.');
            return [];
        }
        return this.synthesis.getVoices();
    }

    // 음성 설정 변경
    setVoice(voice) {
        this.voiceSettings.voice = voice;
    }

    // 속도 설정
    setRate(rate) {
        this.voiceSettings.rate = Math.max(0.1, Math.min(10, rate));
    }

    // 음조 설정
    setPitch(pitch) {
        this.voiceSettings.pitch = Math.max(0, Math.min(2, pitch));
    }

    // 볼륨 설정
    setVolume(volume) {
        this.voiceSettings.volume = Math.max(0, Math.min(1, volume));
    }

    // 텍스트를 음성으로 변환
    speak(text, options = {}) {
        if (!this.isSupported || !this.synthesis) {
            console.warn('TTS가 지원되지 않습니다.');
            return Promise.reject(new Error('TTS가 지원되지 않는 브라우저입니다.'));
        }

        if (!text || this.isSpeaking) {
            return Promise.reject(new Error('이미 재생 중이거나 텍스트가 없습니다.'));
        }

        return new Promise((resolve, reject) => {
            try {
                // 기존 음성 중지
                this.stop();

                // 새로운 utterance 생성
                this.utterance = new SpeechSynthesisUtterance(text);

                // 음성 설정 적용
                this.utterance.voice = options.voice || this.voiceSettings.voice;
                this.utterance.rate = options.rate || this.voiceSettings.rate;
                this.utterance.pitch = options.pitch || this.voiceSettings.pitch;
                this.utterance.volume = options.volume || this.voiceSettings.volume;

                // 이벤트 리스너 설정
                this.utterance.onstart = () => {
                    this.isSpeaking = true;
                    console.log('TTS 시작:', text.substring(0, 50) + '...');
                    if (this.onSpeakStart) this.onSpeakStart(text);
                };

                this.utterance.onend = () => {
                    this.isSpeaking = false;
                    console.log('TTS 종료');
                    if (this.onSpeakEnd) this.onSpeakEnd();
                    resolve();
                };

                this.utterance.onpause = () => {
                    console.log('TTS 일시정지');
                    if (this.onSpeakPause) this.onSpeakPause();
                };

                this.utterance.onresume = () => {
                    console.log('TTS 재개');
                    if (this.onSpeakResume) this.onSpeakResume();
                };

                this.utterance.onerror = (event) => {
                    this.isSpeaking = false;
                    console.error('TTS 오류:', event.error);
                    if (this.onSpeakError) this.onSpeakError(event.error);
                    reject(new Error(`TTS 오류: ${event.error}`));
                };

                // 음성 재생 시작
                this.synthesis.speak(this.utterance);

            } catch (error) {
                console.error('TTS 초기화 오류:', error);
                reject(error);
            }
        });
    }

    // 음성 중지
    stop() {
        if (this.isSupported && this.synthesis) {
            // 모든 진행 중인 음성 중지
            this.synthesis.cancel();
            this.isSpeaking = false;
            this.utterance = null;
            console.log('TTS 중지됨');
        }
    }

    // 음성 일시정지
    pause() {
        if (this.isSupported && this.synthesis && this.isSpeaking) {
            this.synthesis.pause();
        }
    }

    // 음성 재개
    resume() {
        if (this.isSupported && this.synthesis && this.isSpeaking) {
            this.synthesis.resume();
        }
    }

    // 현재 재생 상태 확인
    isCurrentlySpeaking() {
        return this.isSupported && this.isSpeaking;
    }

    // TTS 지원 여부 확인
    isSupported() {
        return this.isSupported;
    }

    // 전역 이벤트 리스너 설정
    setupGlobalEventListeners() {
        if (typeof window === 'undefined') return;

        const handleBeforeUnload = () => {
            console.log('TTS 서비스: 페이지 언로드 시 TTS 중지');
            this.stop();
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                console.log('TTS 서비스: 페이지 숨김 시 TTS 중지');
                this.stop();
            }
        };

        // 페이지 언로드 이벤트
        window.addEventListener('beforeunload', handleBeforeUnload);
        // 페이지 숨김/보임 이벤트
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 이벤트 리스너 정리를 위한 참조 저장
        this._cleanupListeners = () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }

    // 이벤트 리스너 설정
    on(event, callback) {
        switch (event) {
            case 'start':
                this.onSpeakStart = callback;
                break;
            case 'end':
                this.onSpeakEnd = callback;
                break;
            case 'pause':
                this.onSpeakPause = callback;
                break;
            case 'resume':
                this.onSpeakResume = callback;
                break;
            case 'error':
                this.onSpeakError = callback;
                break;
            default:
                console.warn('알 수 없는 TTS 이벤트:', event);
        }
    }

    // 이벤트 리스너 제거
    off(event, callback) {
        switch (event) {
            case 'start':
                this.onSpeakStart = null;
                break;
            case 'end':
                this.onSpeakEnd = null;
                break;
            case 'pause':
                this.onSpeakPause = null;
                break;
            case 'resume':
                this.onSpeakResume = null;
                break;
            case 'error':
                this.onSpeakError = null;
                break;
            default:
                console.warn('알 수 없는 TTS 이벤트:', event);
        }
    }
}

// 싱글톤 인스턴스 생성
const ttsService = new TTSService();

ttsService.isSupported = function () {
    return typeof window !== 'undefined' && !!window.speechSynthesis;
};

export default ttsService; 