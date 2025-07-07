class TTSService {
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.utterance = null;
        this.isSpeaking = false;
        this.onSpeakStart = null;
        this.onSpeakEnd = null;
        this.onSpeakPause = null;
        this.onSpeakResume = null;
        this.onSpeakError = null;
        this.audioContext = null;
        this.hasUserInteracted = false;
        this.isChrome = this.detectChrome();

        // 음성 설정
        this.voiceSettings = {
            rate: 1.0,        // 속도 (0.1 ~ 10) - 1.2배 빠르게
            pitch: 1.0,       // 음조 (0 ~ 2)
            volume: 1.0,      // 볼륨 (0 ~ 1)
            voice: null       // 음성 (시스템에서 선택)
        };

        this.initializeVoice();
        this.initializeAudioContext();
    }

    // 크롬 브라우저 감지
    detectChrome() {
        const userAgent = navigator.userAgent;
        const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
        console.log('브라우저 감지:', isChrome ? 'Chrome' : 'Other');
        return isChrome;
    }

    // 오디오 컨텍스트 초기화 (크롬 자동 재생 정책 우회)
    initializeAudioContext() {
        try {
            // 사용자 상호작용 이벤트 리스너 추가
            const userInteractionEvents = ['click', 'touchstart', 'keydown', 'mousedown'];

            const handleUserInteraction = () => {
                this.hasUserInteracted = true;

                // 오디오 컨텍스트 초기화
                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }

                // 이벤트 리스너 제거
                userInteractionEvents.forEach(event => {
                    document.removeEventListener(event, handleUserInteraction);
                });

                console.log('사용자 상호작용 감지됨 - 오디오 컨텍스트 초기화 완료');
            };

            userInteractionEvents.forEach(event => {
                document.addEventListener(event, handleUserInteraction, { once: true });
            });
        } catch (error) {
            console.warn('오디오 컨텍스트 초기화 실패:', error);
        }
    }

    // 크롬 TTS 문제 진단
    diagnoseChromeTTS() {
        if (!this.isChrome) return { isChrome: false, issues: [] };

        const issues = [];

        // 1. 음성 목록 확인
        const voices = this.synthesis.getVoices();
        if (voices.length === 0) {
            issues.push('음성 목록이 비어있음');
        }

        // 2. 한국어 음성 확인
        const koreanVoices = voices.filter(v => v.lang.includes('ko'));
        if (koreanVoices.length === 0) {
            issues.push('한국어 음성이 없음');
        }

        // 3. TTS 지원 확인
        if (!window.speechSynthesis) {
            issues.push('TTS API를 지원하지 않음');
        }

        console.log('크롬 TTS 진단 결과:', {
            isChrome: this.isChrome,
            totalVoices: voices.length,
            koreanVoices: koreanVoices.length,
            issues: issues
        });

        return { isChrome: this.isChrome, issues };
    }

    // 음성 초기화
    initializeVoice() {
        // 음성 목록 로드 대기
        if (this.synthesis.onvoiceschanged !== undefined) {
            this.synthesis.onvoiceschanged = () => {
                console.log('음성 목록 변경 감지됨');
                this.setDefaultVoice();
            };
        }

        // 초기 음성 설정 시도
        this.setDefaultVoice();

        // 추가로 1초 후 다시 시도 (브라우저가 음성을 완전히 로드할 시간을 줌)
        setTimeout(() => {
            this.setDefaultVoice();
        }, 1000);

        // 3초 후 한 번 더 시도 (더 안정적인 로딩을 위해)
        setTimeout(() => {
            this.setDefaultVoice();
        }, 3000);
    }

    // 기본 음성 설정
    setDefaultVoice() {
        const voices = this.synthesis.getVoices();

        if (voices.length === 0) {
            console.log('음성 목록이 아직 로드되지 않았습니다.');
            return;
        }

        console.log('사용 가능한 음성 목록:', voices.map(v => `${v.name} (${v.lang})`));

        // Google 한국의 (ko-KR) 음성 우선 선택 - 더 정확한 매칭
        let googleKoreanVoice = voices.find(voice =>
            (voice.name.includes('Google 한국의') || voice.name.includes('Google 한국어')) &&
            voice.lang.includes('ko-KR')
        );

        // Google 한국의 음성이 없으면 다른 Google 한국어 음성 찾기
        if (!googleKoreanVoice) {
            googleKoreanVoice = voices.find(voice =>
                voice.name.includes('Google') && voice.lang.includes('ko')
            );
        }

        // Microsoft Heami 한국어 음성
        let microsoftKoreanVoice = voices.find(voice =>
            (voice.name.includes('Korean') || voice.name.includes('Heami') || voice.name.includes('Microsoft')) &&
            voice.lang.includes('ko')
        );

        // 일반적인 한국어 음성 찾기
        let koreanVoice = voices.find(voice =>
            voice.lang.includes('ko') || voice.lang.includes('ko-KR')
        );

        // 한국어가 없으면 영어 음성 선택
        let englishVoice = voices.find(voice =>
            voice.lang.includes('en') || voice.lang.includes('en-US')
        );

        // 기본 음성 설정 (우선순위: Google 한국의 > Microsoft 한국어 > 일반 한국어 > 영어 > 첫 번째 음성)
        this.voiceSettings.voice = googleKoreanVoice || microsoftKoreanVoice || koreanVoice || englishVoice || voices[0];

        console.log('TTS 음성 설정:', {
            selectedVoice: this.voiceSettings.voice?.name,
            selectedLang: this.voiceSettings.voice?.lang,
            availableVoices: voices.length,
            googleKoreanVoice: googleKoreanVoice?.name,
            microsoftKoreanVoice: microsoftKoreanVoice?.name,
            koreanVoice: koreanVoice?.name,
            englishVoice: englishVoice?.name
        });
    }

    // 음성 목록 가져오기
    getVoices() {
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
        if (!text || this.isSpeaking) {
            return Promise.reject(new Error('이미 재생 중이거나 텍스트가 없습니다.'));
        }

        return new Promise((resolve, reject) => {
            try {
                // 크롬 TTS 진단
                if (this.isChrome) {
                    const diagnosis = this.diagnoseChromeTTS();
                    if (diagnosis.issues.length > 0) {
                        console.warn('크롬 TTS 문제 감지:', diagnosis.issues);
                        console.warn('엣지나 파이어폭스 브라우저 사용을 권장합니다.');
                    }
                }

                // 크롬 자동 재생 정책 우회
                if (!this.hasUserInteracted) {
                    console.warn('사용자 상호작용이 필요합니다. TTS가 차단될 수 있습니다.');
                }

                // 오디오 컨텍스트가 일시정지 상태라면 재개
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }

                // 기존 음성 중지
                this.stop();

                // 새로운 utterance 생성
                this.utterance = new SpeechSynthesisUtterance(text);

                // 음성 설정 적용
                this.utterance.voice = options.voice || this.voiceSettings.voice;
                this.utterance.rate = options.rate || this.voiceSettings.rate;
                this.utterance.pitch = options.pitch || this.voiceSettings.pitch;
                this.utterance.volume = options.volume || this.voiceSettings.volume;

                // 크롬 호환성을 위한 추가 설정
                this.utterance.lang = (options.voice || this.voiceSettings.voice)?.lang || 'ko-KR';

                // 크롬에서 TTS가 안 될 때를 대비한 타이머
                let chromeFallbackTimer = null;
                if (this.isChrome) {
                    chromeFallbackTimer = setTimeout(() => {
                        console.warn('크롬에서 TTS가 시작되지 않았습니다. 대안 방법을 시도합니다.');
                        this.tryChromeFallback(text, options, resolve, reject);
                    }, 2000); // 2초 후 대안 방법 시도
                }

                // 이벤트 리스너 설정
                this.utterance.onstart = () => {
                    this.isSpeaking = true;
                    console.log('TTS 시작:', text.substring(0, 50) + '...');

                    // 크롬 fallback 타이머 취소
                    if (chromeFallbackTimer) {
                        clearTimeout(chromeFallbackTimer);
                    }

                    if (this.onSpeakStart) this.onSpeakStart(text);
                };

                this.utterance.onend = () => {
                    this.isSpeaking = false;
                    console.log('TTS 종료');

                    // 크롬 fallback 타이머 취소
                    if (chromeFallbackTimer) {
                        clearTimeout(chromeFallbackTimer);
                    }

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

                    // 크롬 fallback 타이머 취소
                    if (chromeFallbackTimer) {
                        clearTimeout(chromeFallbackTimer);
                    }

                    // 크롬 특정 오류 처리
                    if (event.error === 'not-allowed') {
                        console.error('크롬에서 TTS가 차단되었습니다. 사용자 상호작용이 필요합니다.');
                    }

                    // 크롬에서 TTS가 안 될 때 안내
                    if (this.isChrome && event.error === 'interrupted') {
                        console.error('크롬에서 TTS가 중단되었습니다. 엣지나 파이어폭스 사용을 권장합니다.');
                    }

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

    // 크롬 TTS fallback 방법
    tryChromeFallback(text, options, resolve, reject) {
        try {
            console.log('크롬 TTS fallback 시도 중...');

            // 크롬에서 TTS가 작동하지 않는 경우 사용자에게 안내
            if (this.isChrome) {
                console.warn('Chrome에서 TTS가 작동하지 않습니다. Edge 브라우저 사용을 권장합니다.');
                
                // 사용자에게 알림
                if (window.confirm('Chrome에서 TTS가 작동하지 않습니다. Edge 브라우저로 이동하시겠습니까?')) {
                    window.open('microsoft-edge:http://192.168.44.9:3000', '_blank');
                }
                
                reject(new Error('Chrome TTS not supported'));
                return;
            }

            // 새로운 utterance 생성 (크롬 버그 우회)
            const fallbackUtterance = new SpeechSynthesisUtterance(text);

            // 기본 설정만 적용 (복잡한 설정 제거)
            fallbackUtterance.lang = 'ko-KR';
            fallbackUtterance.rate = 1.0;
            fallbackUtterance.pitch = 1.0;
            fallbackUtterance.volume = 1.0;

            // 이벤트 리스너
            fallbackUtterance.onstart = () => {
                this.isSpeaking = true;
                console.log('크롬 TTS fallback 시작');
                if (this.onSpeakStart) this.onSpeakStart(text);
            };

            fallbackUtterance.onend = () => {
                this.isSpeaking = false;
                console.log('크롬 TTS fallback 종료');
                if (this.onSpeakEnd) this.onSpeakEnd();
                resolve();
            };

            fallbackUtterance.onerror = (event) => {
                this.isSpeaking = false;
                console.error('크롬 TTS fallback 오류:', event.error);
                reject(new Error(`크롬 TTS fallback 오류: ${event.error}`));
            };

            // fallback 재생 시작
            this.synthesis.speak(fallbackUtterance);

        } catch (error) {
            console.error('크롬 TTS fallback 실패:', error);
            reject(error);
        }
    }

    // 음성 중지
    stop() {
        if (this.isSpeaking) {
            this.synthesis.cancel();
            this.isSpeaking = false;
            console.log('TTS 중지됨');
        }
    }

    // 음성 일시정지
    pause() {
        if (this.isSpeaking) {
            this.synthesis.pause();
        }
    }

    // 음성 재개
    resume() {
        if (this.isSpeaking) {
            this.synthesis.resume();
        }
    }

    // 현재 재생 상태 확인
    isCurrentlySpeaking() {
        return this.isSpeaking;
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
}

// 싱글톤 인스턴스 생성
const ttsService = new TTSService();

export default ttsService; 