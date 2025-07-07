const READY_PLAYER_ME_API_KEY = 'sk_live_8si9MKqvVzTEpvAzt2pEh5j1qPuf7fMvqetK';
const READY_PLAYER_ME_BASE_URL = 'https://api.readyplayer.me/v1';

class ReadyPlayerMeService {
    constructor() {
        this.apiKey = READY_PLAYER_ME_API_KEY;
        this.baseUrl = READY_PLAYER_ME_BASE_URL;
    }

    // 기본 헤더 설정
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
    }

    // 아바타 생성 (랜덤)
    async createRandomAvatar(gender = 'male') {
        try {
            const response = await fetch(`${this.baseUrl}/avatars`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    gender: gender,
                    style: 'realistic', // 'realistic', 'cartoon', 'anime'
                    // 추가 옵션들
                    outfit: 'casual',
                    hair: 'short',
                    eyes: 'brown',
                    skin: 'light'
                })
            });

            if (!response.ok) {
                throw new Error(`Avatar creation failed: ${response.statusText}`);
            }

            const data = await response.json();
            return data.avatarUrl;
        } catch (error) {
            console.error('Error creating avatar:', error);
            // 기본 아바타 URL 반환 (테스트용)
            return this.getDefaultAvatarUrl(gender);
        }
    }

    // 기본 아바타 URL (API 실패 시 사용)
    getDefaultAvatarUrl(gender = 'male') {
        const defaultAvatars = {
            male: 'https://models.readyplayer.me/6868236a3a108058018aa554.glb',
            female: 'https://models.readyplayer.me/6868261ba6e60aed0c1d79ad.glb'
        };
        return defaultAvatars[gender] || defaultAvatars.male;
    }

    // 실제 작동하는 샘플 아바타 URL들 (Ready Player Me 공식 샘플)
    getSampleAvatars() {
        return {
            user: '/avatar/6868236a3a108058018aa554.glb',
            ai: '/avatar/6868261ba6e60aed0c1d79ad.glb'
        };
    }

    // 아바타 정보 조회
    async getAvatarInfo(avatarId) {
        try {
            const response = await fetch(`${this.baseUrl}/avatars/${avatarId}`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to get avatar info: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting avatar info:', error);
            return null;
        }
    }

    // 아바타 업데이트
    async updateAvatar(avatarId, updates) {
        try {
            const response = await fetch(`${this.baseUrl}/avatars/${avatarId}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                throw new Error(`Failed to update avatar: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating avatar:', error);
            return null;
        }
    }

    // 아바타 애니메이션 적용
    async applyAnimation(avatarId, animationType) {
        try {
            const response = await fetch(`${this.baseUrl}/avatars/${avatarId}/animations`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    animation: animationType // 'idle', 'talking', 'walking', 'sitting'
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to apply animation: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error applying animation:', error);
            return null;
        }
    }

    // 아바타 삭제
    async deleteAvatar(avatarId) {
        try {
            const response = await fetch(`${this.baseUrl}/avatars/${avatarId}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to delete avatar: ${response.statusText}`);
            }

            return true;
        } catch (error) {
            console.error('Error deleting avatar:', error);
            return false;
        }
    }

    // 아바타 URL 생성 (실제 사용 시)
    generateAvatarUrl(avatarId, format = 'glb') {
        return `https://models.readyplayer.me/${avatarId}.${format}`;
    }
}

// 싱글톤 인스턴스 생성
const readyPlayerMeService = new ReadyPlayerMeService();

export default readyPlayerMeService; 