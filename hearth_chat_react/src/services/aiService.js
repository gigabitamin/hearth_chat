import { getApiBase, csrfFetch, getCookie } from '../app.js';

class AIService {
    constructor() {
        this.settings = null;
        this.isInitialized = false;
    }

    // AI 설정 초기화
    initialize(settings) {
        this.settings = settings;
        this.isInitialized = true;
        // console.log('🤖 AI 서비스 초기화됨:', settings);
        // console.log('🔧 현재 AI 제공자:', settings.aiProvider);
        // console.log('🔧 Lily API URL:', settings.lilyApiUrl);
        // console.log('🔧 Lily 모델:', settings.lilyModel);
    }

    // AI 응답 생성
    async generateResponse(message, context = '', options = {}) {
        if (!this.isInitialized || !this.settings?.aiEnabled) {
            throw new Error('AI 서비스가 초기화되지 않았거나 비활성화되어 있습니다.');
        }

        console.log('🚀 AI 응답 생성 시작');
        console.log('📝 메시지:', message);
        console.log('🔧 AI 제공자:', this.settings.aiProvider);
        console.log('🔧 현재 설정:', this.settings);

        try {
            switch (this.settings.aiProvider) {
                case 'lily':
                    console.log('🌿 Lily LLM 사용');
                    return await this.generateLilyResponse(message, context, options);
                case 'chatgpt':
                    console.log('💬 ChatGPT 사용');
                    return await this.generateChatGPTResponse(message, context);
                case 'gemini':
                    console.log('🌟 Gemini 사용');
                    return await this.generateGeminiResponse(message, context);
                default:
                    console.error('❌ 지원하지 않는 AI 제공자:', this.settings.aiProvider);
                    throw new Error(`지원하지 않는 AI 제공자: ${this.settings.aiProvider}`);
            }
        } catch (error) {
            console.error('❌ AI 응답 생성 실패:', error);
            throw error;
        }
    }

    // Lily API 응답 생성
    async generateLilyResponse(message, context = '', options = {}) {
        console.log('🌿 Lily API 호출 시작');
        console.log('🔗 API URL:', `${this.settings.lilyApiUrl}/api/v2/generate`);
        console.log('🔧 모델:', this.settings.lilyModel);

        const url = `${this.settings.lilyApiUrl}/api/v2/generate`;

        const formData = new FormData();
        formData.append('prompt', message);
        formData.append('model_id', this.settings.lilyModel);
        formData.append('max_length', this.settings.maxTokens);
        formData.append('temperature', this.settings.temperature);
        // formData.append('top_p', 0.9);
        // formData.append('do_sample', true);
        // formData.append('use_rag_text', true);
        // formData.append('image_short_side', 128);

        // 옵션 전달: use_rag_images / use_rag_text / image_short_side
        try {
            const { useRagImages, useRagText, imageShortSide } = options || {};
            if (typeof useRagImages === 'boolean') {
                formData.append('use_rag_images', useRagImages ? 'true' : 'false');
            }
            if (typeof useRagText === 'boolean') {
                formData.append('use_rag_text', useRagText ? 'true' : 'false');
            }
            if (typeof imageShortSide === 'number') {
                formData.append('image_short_side', String(imageShortSide));
            }
        } catch (e) {
            console.warn('옵션 전달 중 경고:', e);
        }

        console.log('📤 요청 데이터:', {
            prompt: message,
            model_id: this.settings.lilyModel,
            max_length: this.settings.maxTokens,
            temperature: this.settings.temperature,
            ...(options && typeof options.useRagImages === 'boolean' ? { use_rag_images: options.useRagImages } : {}),
            ...(options && typeof options.useRagText === 'boolean' ? { use_rag_text: options.useRagText } : {}),
            ...(options && typeof options.imageShortSide === 'number' ? { image_short_side: options.imageShortSide } : {})
        });

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        console.log('📥 응답 상태:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Lily API 오류:', errorText);
            throw new Error(`Lily API 오류: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ Lily API 응답 성공:', data);

        return {
            text: data.generated_text,
            model: data.model_name,
            processingTime: data.processing_time
        };
    }

    // ChatGPT API 응답 생성
    async generateChatGPTResponse(message, context = '') {
        const url = 'https://api.openai.com/v1/chat/completions';

        const requestBody = {
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: '당신은 친근하고 도움이 되는 AI 어시스턴트입니다. 한국어로 대화해주세요.'
                },
                {
                    role: 'user',
                    content: context ? `${context}\n\n사용자: ${message}` : message
                }
            ],
            max_tokens: this.settings.maxTokens,
            temperature: this.settings.temperature,
            top_p: 0.9
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.chatgptApiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`ChatGPT API 오류: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return {
            text: data.choices[0].message.content,
            model: 'gpt-3.5-turbo',
            processingTime: null
        };
    }

    // Gemini API 응답 생성
    async generateGeminiResponse(message, context = '') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.settings.geminiApiKey}`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: context ? `${context}\n\n사용자: ${message}` : message
                        }
                    ]
                }
            ],
            generationConfig: {
                maxOutputTokens: this.settings.maxTokens,
                temperature: this.settings.temperature,
                topP: 0.9
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API 오류: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return {
            text: data.candidates[0].content.parts[0].text,
            model: 'gemini-pro',
            processingTime: null
        };
    }

    // AI 응답 지연 처리
    async generateResponseWithDelay(message, context = '') {
        if (this.settings.responseDelay > 0) {
            console.log(`⏳ 응답 지연: ${this.settings.responseDelay}ms`);
            await new Promise(resolve => setTimeout(resolve, this.settings.responseDelay));
        }

        return await this.generateResponse(message, context);
    }

    // AI 설정 가져오기
    getSettings() {
        return this.settings;
    }

    // AI 활성화 상태 확인
    isEnabled() {
        return this.isInitialized && this.settings?.aiEnabled;
    }

    // 자동 응답 활성화 상태 확인
    isAutoRespondEnabled() {
        return this.isEnabled() && this.settings?.autoRespond;
    }

    // AI 제공자 정보 가져오기
    getProviderInfo() {
        if (!this.settings) return null;

        const providers = {
            lily: {
                name: 'Lily LLM',
                description: '로컬 실행 AI 모델',
                color: '#667eea'
            },
            chatgpt: {
                name: 'ChatGPT',
                description: 'OpenAI GPT 모델',
                color: '#10a37f'
            },
            gemini: {
                name: 'Gemini',
                description: 'Google AI 모델',
                color: '#4285f4'
            }
        };

        return providers[this.settings.aiProvider] || null;
    }

    // 연결 테스트
    async testConnection() {
        if (!this.settings) {
            throw new Error('AI 설정이 없습니다.');
        }

        try {
            switch (this.settings.aiProvider) {
                case 'lily':
                    console.log('🔗 Lily API 연결 테스트 중...');
                    const response = await fetch(`${this.settings.lilyApiUrl}/api/v2/health`);
                    if (!response.ok) {
                        throw new Error(`Lily API 연결 실패: ${response.status}`);
                    }
                    const healthData = await response.json();
                    console.log('✅ Lily API 연결 성공:', healthData);
                    return { success: true, message: 'Lily API 연결 성공!' };

                case 'chatgpt':
                    const chatgptResponse = await fetch('https://api.openai.com/v1/models', {
                        headers: {
                            'Authorization': `Bearer ${this.settings.chatgptApiKey}`
                        }
                    });
                    if (!chatgptResponse.ok) {
                        throw new Error(`ChatGPT API 연결 실패: ${chatgptResponse.status}`);
                    }
                    return { success: true, message: 'ChatGPT API 연결 성공!' };

                case 'gemini':
                    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.settings.geminiApiKey}`);
                    if (!geminiResponse.ok) {
                        throw new Error(`Gemini API 연결 실패: ${geminiResponse.status}`);
                    }
                    return { success: true, message: 'Gemini API 연결 성공!' };

                default:
                    throw new Error(`지원하지 않는 AI 제공자: ${this.settings.aiProvider}`);
            }
        } catch (error) {
            console.error('❌ 연결 테스트 실패:', error);
            return { success: false, message: error.message };
        }
    }
}

// 싱글톤 인스턴스 생성
const aiService = new AIService();

export default aiService; 