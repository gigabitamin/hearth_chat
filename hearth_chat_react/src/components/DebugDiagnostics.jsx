import React from 'react';
import { API_BASE, getCookie } from '../utils/apiConfig';

const DebugDiagnostics = () => {
    const [log, setLog] = React.useState([]);
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [roomId, setRoomId] = React.useState('');
    const wsRef = React.useRef(null);
    const append = (m) => setLog((prev) => [...prev, `${new Date().toISOString()} ${m}`]);

    const run = async () => {
        try {
            append(`API_BASE=${API_BASE}`);
            // health
            try {
                const r = await fetch(`${API_BASE}/health/`, { credentials: 'include' });
                append(`health: ${r.status}`);
            } catch (e) { append(`health error: ${e}`); }
            // csrf
            try {
                const r = await fetch(`${API_BASE}/api/csrf/?mobile=1`, { credentials: 'include', headers: { 'X-From-App': '1' } });
                append(`csrf: ${r.status}`);
                try {
                    const data = await r.json();
                    if (data && data.token) {
                        append(`csrf token(json): ${String(data.token).slice(0, 8)}...`);
                        // 토큰을 window 전역에 저장하여 다음 요청에서 사용
                        window.__csrf_token_from_json = data.token;
                    }
                } catch { }
            } catch (e) { append(`csrf error: ${e}`); }
            append(`cookie(after csrf): ${document.cookie}`);
            // login
            if (email && password) {
                try {
                    const csrftoken = getCookie('csrftoken') || window.__csrf_token_from_json || '';
                    const r = await fetch(`${API_BASE}/api/login/?mobile=1`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrftoken,
                            'X-From-App': '1'
                        },
                        body: JSON.stringify({ login: email, password })
                    });
                    const t = await r.text();
                    append(`login: ${r.status} body=${t.slice(0, 200)}`);
                    append(`cookie(after login): ${document.cookie}`);
                } catch (e) { append(`login error: ${e}`); }
            }
        } catch (e) {
            append(`fatal: ${e}`);
        }
    };

    const testWs = async () => {
        try {
            const host = API_BASE.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
            const scheme = API_BASE.startsWith('https') ? 'wss://' : 'ws://';
            const path = roomId ? `/ws/chat/${roomId}/` : '/ws/chat/';
            const wsUrl = `${scheme}${host}${path}`;
            append(`ws.connect → ${wsUrl}`);
            if (wsRef.current && wsRef.current.readyState === 1) {
                try { wsRef.current.close(); } catch { }
            }
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;
            ws.onopen = () => append('ws.onopen');
            ws.onerror = (e) => append(`ws.onerror`);
            ws.onclose = (e) => append(`ws.onclose code=${e.code} reason=${e.reason}`);
            ws.onmessage = (m) => append(`ws.onmessage: ${String(m.data).slice(0, 100)}`);
            setTimeout(() => { try { ws.send(JSON.stringify({ type: 'ping' })); append('ws.send ping'); } catch { } }, 500);
        } catch (e) {
            append(`ws fatal: ${e}`);
        }
    };

    return (
        <div style={{ padding: 12, border: '1px solid #444', borderRadius: 8, marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>모바일 진단 패널</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} style={{ flex: 1 }} />
                <input placeholder="비밀번호" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ flex: 1 }} />
                <button onClick={run}>진단 실행</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input placeholder="WS roomId (선택)" value={roomId} onChange={e => setRoomId(e.target.value)} style={{ flex: 1 }} />
                <button onClick={testWs}>WS 테스트</button>
            </div>
            <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', background: '#111', color: '#0f0', padding: 8 }}>{log.join('\n')}</div>
        </div>
    );
};

export default DebugDiagnostics;


