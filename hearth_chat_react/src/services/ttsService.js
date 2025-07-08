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

        // 립싱크 관련 설정
        this.lipSyncSettings = {
            enabled: true,    // 립싱크 활성화
            intensity: 0.8,   // 립싱크 강도 (0 ~ 1)
            speed: 1.0        // 립싱크 속도 배율
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

    // TTS용 텍스트 정리 (이모티콘, 특수문자 제거)
    cleanTextForTTS(text) {
        if (!text) return '';

        let cleanedText = text;

        // 1. 이모티콘 제거 (유니코드 이모티콘 범위)
        const emojiRanges = [
            /[\u{1F600}-\u{1F64F}]/gu,  // 감정 표현
            /[\u{1F300}-\u{1F5FF}]/gu,  // 기호와 픽토그램
            /[\u{1F680}-\u{1F6FF}]/gu,  // 교통과 지도
            /[\u{1F1E0}-\u{1F1FF}]/gu,  // 국기
            /[\u{2600}-\u{26FF}]/gu,    // 기타 기호
            /[\u{2700}-\u{27BF}]/gu,    // 장식 기호
            /[\u{1F900}-\u{1F9FF}]/gu,  // 보충 기호와 픽토그램
            /[\u{1FA70}-\u{1FAFF}]/gu,  // 기호와 픽토그램 확장
            /[\u{1FAB0}-\u{1FABF}]/gu,  // 동물과 자연
            /[\u{1FAC0}-\u{1FAFF}]/gu,  // 신체 부위
            /[\u{1FAD0}-\u{1FAFF}]/gu,  // 음식과 음료
            /[\u{1FAE0}-\u{1FAFF}]/gu,  // 장소
            /[\u{1FAF0}-\u{1FAFF}]/gu   // 기타
        ];

        emojiRanges.forEach(range => {
            cleanedText = cleanedText.replace(range, '');
        });

        // 2. 특정 이모티콘 패턴 제거 (이스케이프된 이모티콘)
        cleanedText = cleanedText.replace(/\\u[\dA-Fa-f]{4}/g, '');

        // 3. 특수문자 제거 (한글, 영어, 숫자, 기본 문장부호만 유지)
        cleanedText = cleanedText.replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ.,!?;:()[\]{}"'`~@#$%^&*+=|\\<>/]/g, '');

        // 4. 연속된 공백을 하나로 정리
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

        // 5. 빈 문자열 체크 및 대체 텍스트 제공
        if (!cleanedText || cleanedText.length === 0) {
            // 원본에서 한글/영어/숫자만 추출
            const fallbackText = text.replace(/[^\w\s가-힣ㄱ-ㅎㅏ-ㅣ]/g, '').trim();
            return fallbackText || '음성 메시지';
        }

        return cleanedText;
    }

    // 한글 자음/모음 분석
    analyzeKoreanPhonemes(text) {
        const phonemes = [];

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const code = char.charCodeAt(0);

            // 한글 유니코드 범위 (가-힣: 44032-55203)
            if (code >= 44032 && code <= 55203) {
                const syllable = code - 44032;
                const initial = Math.floor(syllable / 588);      // 초성
                const medial = Math.floor((syllable % 588) / 28); // 중성
                const final = syllable % 28;                     // 종성

                // 초성 (자음)
                const initialConsonants = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
                if (initial < initialConsonants.length) {
                    phonemes.push({
                        type: 'consonant',
                        char: initialConsonants[initial],
                        position: 'initial',
                        mouthShape: this.getMouthShapeForConsonant(initialConsonants[initial])
                    });
                }

                // 중성 (모음)
                const medialVowels = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
                if (medial < medialVowels.length) {
                    phonemes.push({
                        type: 'vowel',
                        char: medialVowels[medial],
                        position: 'medial',
                        mouthShape: this.getMouthShapeForVowel(medialVowels[medial])
                    });
                }

                // 종성 (자음)
                const finalConsonants = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
                if (final > 0 && final < finalConsonants.length) {
                    phonemes.push({
                        type: 'consonant',
                        char: finalConsonants[final],
                        position: 'final',
                        mouthShape: this.getMouthShapeForConsonant(finalConsonants[final])
                    });
                }
            } else if (/[a-zA-Z]/.test(char)) {
                // 영어 알파벳
                phonemes.push({
                    type: 'english',
                    char: char.toLowerCase(),
                    position: 'single',
                    mouthShape: this.getMouthShapeForEnglish(char.toLowerCase())
                });
            } else if (/[0-9]/.test(char)) {
                // 숫자
                phonemes.push({
                    type: 'number',
                    char: char,
                    position: 'single',
                    mouthShape: 'neutral'
                });
            } else {
                // 기타 문자 (공백, 문장부호 등)
                phonemes.push({
                    type: 'other',
                    char: char,
                    position: 'single',
                    mouthShape: 'neutral'
                });
            }
        }

        return phonemes;
    }

    // 자음에 따른 입모양 매핑
    getMouthShapeForConsonant(consonant) {
        const mouthShapes = {
            'ㄱ': 'closed',      // 입을 다물고
            'ㄲ': 'closed',      // 입을 다물고
            'ㄴ': 'slightly_open', // 살짝 벌리고
            'ㄷ': 'closed',      // 입을 다물고
            'ㄸ': 'closed',      // 입을 다물고
            'ㄹ': 'slightly_open', // 살짝 벌리고
            'ㅁ': 'closed',      // 입을 다물고
            'ㅂ': 'closed',      // 입을 다물고
            'ㅃ': 'closed',      // 입을 다물고
            'ㅅ': 'slightly_open', // 살짝 벌리고
            'ㅆ': 'slightly_open', // 살짝 벌리고
            'ㅇ': 'open',        // 입을 벌리고
            'ㅈ': 'slightly_open', // 살짝 벌리고
            'ㅉ': 'slightly_open', // 살짝 벌리고
            'ㅊ': 'slightly_open', // 살짝 벌리고
            'ㅋ': 'open',        // 입을 벌리고
            'ㅌ': 'slightly_open', // 살짝 벌리고
            'ㅍ': 'closed',      // 입을 다물고
            'ㅎ': 'open'         // 입을 벌리고
        };
        return mouthShapes[consonant] || 'neutral';
    }

    // 모음에 따른 입모양 매핑
    getMouthShapeForVowel(vowel) {
        const mouthShapes = {
            'ㅏ': 'wide_open',   // 입을 크게 벌리고
            'ㅐ': 'wide_open',   // 입을 크게 벌리고
            'ㅑ': 'wide_open',   // 입을 크게 벌리고
            'ㅒ': 'wide_open',   // 입을 크게 벌리고
            'ㅓ': 'open',        // 입을 벌리고
            'ㅔ': 'open',        // 입을 벌리고
            'ㅕ': 'open',        // 입을 벌리고
            'ㅖ': 'open',        // 입을 벌리고
            'ㅗ': 'rounded',     // 입을 둥글게
            'ㅘ': 'rounded',     // 입을 둥글게
            'ㅙ': 'rounded',     // 입을 둥글게
            'ㅚ': 'rounded',     // 입을 둥글게
            'ㅛ': 'rounded',     // 입을 둥글게
            'ㅜ': 'rounded',     // 입을 둥글게
            'ㅝ': 'rounded',     // 입을 둥글게
            'ㅞ': 'rounded',     // 입을 둥글게
            'ㅟ': 'rounded',     // 입을 둥글게
            'ㅠ': 'rounded',     // 입을 둥글게
            'ㅡ': 'neutral',     // 중립
            'ㅢ': 'neutral',     // 중립
            'ㅣ': 'wide_open'    // 입을 크게 벌리고
        };
        return mouthShapes[vowel] || 'neutral';
    }

    // 영어 알파벳에 따른 입모양 매핑
    getMouthShapeForEnglish(letter) {
        const mouthShapes = {
            'a': 'wide_open',   // 입을 크게 벌리고
            'e': 'open',        // 입을 벌리고
            'i': 'wide_open',   // 입을 크게 벌리고
            'o': 'rounded',     // 입을 둥글게
            'u': 'rounded',     // 입을 둥글게
            'b': 'closed',      // 입을 다물고
            'p': 'closed',      // 입을 다물고
            'm': 'closed',      // 입을 다물고
            'f': 'slightly_open', // 살짝 벌리고
            'v': 'slightly_open', // 살짝 벌리고
            'w': 'rounded',     // 입을 둥글게
            'y': 'slightly_open', // 살짝 벌리고
            'l': 'slightly_open', // 살짝 벌리고
            'r': 'slightly_open', // 살짝 벌리고
            's': 'slightly_open', // 살짝 벌리고
            'z': 'slightly_open', // 살짝 벌리고
            't': 'slightly_open', // 살짝 벌리고
            'd': 'slightly_open', // 살짝 벌리고
            'n': 'slightly_open', // 살짝 벌리고
            'g': 'open',        // 입을 벌리고
            'k': 'open',        // 입을 벌리고
            'h': 'open'         // 입을 벌리고
        };
        return mouthShapes[letter] || 'neutral';
    }

    // 립싱크 시퀀스 생성
    generateLipSyncSequence(text, duration) {
        if (!this.lipSyncSettings.enabled) return [];

        const phonemes = this.analyzeKoreanPhonemes(text);
        const sequence = [];
        const totalPhonemes = phonemes.length;

        if (totalPhonemes === 0) return sequence;

        // 각 음소당 시간 계산 (더 정확한 시간 분배)
        const timePerPhoneme = duration / totalPhonemes;

        phonemes.forEach((phoneme, index) => {
            const startTime = index * timePerPhoneme;
            const endTime = (index + 1) * timePerPhoneme;

            // 음소 타입에 따른 지속 시간 조정
            let adjustedStartTime = startTime;
            let adjustedEndTime = endTime;

            if (phoneme.type === 'vowel') {
                // 모음은 더 길게 지속
                adjustedEndTime = endTime + timePerPhoneme * 0.3;
            } else if (phoneme.type === 'consonant') {
                // 자음은 더 짧게
                adjustedEndTime = endTime - timePerPhoneme * 0.2;
            }

            sequence.push({
                startTime: adjustedStartTime,
                endTime: adjustedEndTime,
                mouthShape: phoneme.mouthShape,
                intensity: this.lipSyncSettings.intensity,
                phoneme: phoneme.char,
                type: phoneme.type
            });
        });

        console.log('립싱크 시퀀스 생성 완료:', sequence.length, '개 음소, 총 시간:', duration, 'ms');
        console.log('립싱크 시퀀스 샘플 (처음 5개):', sequence.slice(0, 5));
        return sequence;
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

        // TTS용 텍스트 정리
        const cleanedText = this.cleanTextForTTS(text);
        if (!cleanedText) {
            return Promise.reject(new Error('TTS로 읽을 수 있는 텍스트가 없습니다.'));
        }

        return new Promise((resolve, reject) => {
            try {
                // 기존 음성 중지
                this.stop();

                // 새로운 utterance 생성 (정리된 텍스트 사용)
                this.utterance = new SpeechSynthesisUtterance(cleanedText);

                // 음성 설정 적용
                this.utterance.voice = options.voice || this.voiceSettings.voice;
                this.utterance.rate = options.rate || this.voiceSettings.rate;
                this.utterance.pitch = options.pitch || this.voiceSettings.pitch;
                this.utterance.volume = options.volume || this.voiceSettings.volume;

                // 립싱크 시퀀스 생성 (예상 재생 시간 계산)
                const estimatedDuration = cleanedText.length * 150; // 글자당 약 150ms (더 정확한 시간)
                const lipSyncSequence = this.generateLipSyncSequence(cleanedText, estimatedDuration);

                // 이벤트 리스너 설정
                this.utterance.onstart = () => {
                    this.isSpeaking = true;
                    console.log('TTS 시작 (원본):', text.substring(0, 50) + '...');
                    console.log('TTS 시작 (정리됨):', cleanedText.substring(0, 50) + '...');
                    console.log('립싱크 시퀀스:', lipSyncSequence.length, '개 음소');
                    if (this.onSpeakStart) this.onSpeakStart(text, lipSyncSequence); // 립싱크 시퀀스도 함께 전달
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