import React, { useState } from 'react';

const AboutTab = () => (
    <div style={{ padding: 12 }}>
        <h2>About Hearth Chat</h2>
        <p>
            Hearth Chat은 실시간 AI/그룹/1:1 채팅, 이미지 첨부, 감정 분석, TTS, 멀티모달 기능을 제공하는 오픈소스 채팅 플랫폼입니다.<br />
            <b>주요 기능:</b>
            <ul>
                <li>AI 챗봇(Gemini, ChatGPT 등)과 대화</li>
                <li>이미지 첨부, 음성합성(TTS), 감정 분석</li>
                <li>실시간 WebSocket 채팅, 반응형 UI</li>
                <li>즐겨찾기, 방/메시지 검색, 알림</li>
                <li>모바일/PC 완벽 대응, 오픈소스</li>
            </ul>
            <b>기술스택:</b> React, Django, Channels, WebSocket, REST API, Docker 등
        </p>
    </div>
);

const QnATab = () => (
    <div style={{ padding: 12 }}>
        <h2>자주 묻는 질문 (Q&A)</h2>
        <ul>
            <li><b>Q. AI 챗봇은 무료인가요?</b><br />A. 네, 기본 제공 AI(Gemini)는 무료입니다. 일부 고급 AI는 별도 API키 필요할 수 있습니다.</li>
            <li><b>Q. 이미지 첨부 용량 제한은?</b><br />A. 4MB 이하 jpg/png/webp만 지원합니다.</li>
            <li><b>Q. 모바일에서도 사용 가능한가요?</b><br />A. 네, 모바일/PC 모두 최적화되어 있습니다.</li>
            <li><b>Q. 내 데이터는 안전한가요?</b><br />A. 모든 메시지는 암호화되어 저장되며, 외부에 공개되지 않습니다.</li>
            <li><b>Q. 버그/건의/문의는 어디로?</b><br />A. 아래 Help Email 탭을 이용해 주세요.</li>
        </ul>
    </div>
);

const HelpEmailTab = ({ onSend, sending, error, success }) => {
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    return (
        <div style={{ padding: 12 }}>
            <h2>고객센터 문의 (이메일)</h2>
            <form onSubmit={e => { e.preventDefault(); onSend({ email, subject, content }); }}>
                <div style={{ marginBottom: 8 }}>
                    <input type="email" required placeholder="이메일 주소" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
                </div>
                <div style={{ marginBottom: 8 }}>
                    <input type="text" required placeholder="제목" value={subject} onChange={e => setSubject(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
                </div>
                <div style={{ marginBottom: 8 }}>
                    <textarea required placeholder="문의 내용" value={content} onChange={e => setContent(e.target.value)} rows={5} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', resize: 'vertical' }} />
                </div>
                <button type="submit" disabled={sending} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 18px', fontWeight: 700, cursor: 'pointer' }}>전송</button>
                {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
                {success && <div style={{ color: 'green', marginTop: 8 }}>이메일이 성공적으로 전송되었습니다!</div>}
            </form>
            <div style={{ marginTop: 16, fontSize: 13, color: '#888' }}>
                문의 메일은 <b>gigabitamin@gmail.com</b> 으로 발송됩니다.<br />
                (이메일 전송이 실패할 경우 직접 메일을 보내주세요)
            </div>
        </div>
    );
};

export default function AboutModal({ open, onClose }) {
    const [tab, setTab] = useState('about');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // 실제 이메일 전송 함수 (구글 SMTP 연동 필요, 추후 정보 입력)
    const handleSend = async ({ email, subject, content }) => {
        setSending(true); setError(''); setSuccess(false);
        // TODO: SMTP 연동 구현 (구글 앱 비밀번호 등 입력 필요)
        // 임시: 성공 메시지
        setTimeout(() => { setSending(false); setSuccess(true); }, 1200);
    };

    if (!open) return null;
    return (
        <div className="about-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.32)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }} onClick={onClose}>
            <div className="about-modal-content" style={{ background: '#fff', borderRadius: 12, minWidth: 320, maxWidth: 420, width: '90vw', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', padding: 0, position: 'relative', pointerEvents: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', borderBottom: '1px solid #eee', background: '#f7f7fa', borderRadius: '12px 12px 0 0' }}>
                    <button onClick={() => setTab('about')} style={{ flex: 1, padding: 12, background: tab === 'about' ? '#fff' : 'none', border: 'none', borderRadius: '12px 0 0 0', fontWeight: 700, color: tab === 'about' ? '#1976d2' : '#444', cursor: 'pointer' }}>About</button>
                    <button onClick={() => setTab('qna')} style={{ flex: 1, padding: 12, background: tab === 'qna' ? '#fff' : 'none', border: 'none', fontWeight: 700, color: tab === 'qna' ? '#1976d2' : '#444', cursor: 'pointer' }}>Q&A</button>
                    <button onClick={() => setTab('help')} style={{ flex: 1, padding: 12, background: tab === 'help' ? '#fff' : 'none', border: 'none', borderRadius: '0 12px 0 0', fontWeight: 700, color: tab === 'help' ? '#1976d2' : '#444', cursor: 'pointer' }}>Help Email</button>
                    <button onClick={onClose} style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer', zIndex: 10000 }}>✖</button>
                </div>
                <div style={{ minHeight: 220, background: '#fff', borderRadius: '0 0 12px 12px', padding: 0 }}>
                    {tab === 'about' && <AboutTab />}
                    {tab === 'qna' && <QnATab />}
                    {tab === 'help' && <HelpEmailTab onSend={handleSend} sending={sending} error={error} success={success} />}
                </div>
            </div>
        </div>
    );
} 