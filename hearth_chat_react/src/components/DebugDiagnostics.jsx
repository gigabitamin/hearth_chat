import React from 'react';
import { API_BASE, getCookie } from '../utils/apiConfig';

const DebugDiagnostics = () => {
  const [log, setLog] = React.useState([]);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
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
      } catch (e) { append(`csrf error: ${e}`); }
      append(`cookie(after csrf): ${document.cookie}`);
      // login
      if (email && password) {
        try {
          const csrftoken = getCookie('csrftoken');
          const form = new FormData();
          form.append('login', email);
          form.append('password', password);
          const r = await fetch(`${API_BASE}/api/login/?mobile=1`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-CSRFToken': csrftoken || '', 'X-From-App': '1' },
            body: form,
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

  return (
    <div style={{ padding: 12, border: '1px solid #444', borderRadius: 8, marginTop: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>모바일 진단 패널</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} style={{ flex: 1 }} />
        <input placeholder="비밀번호" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ flex: 1 }} />
        <button onClick={run}>진단 실행</button>
      </div>
      <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', background: '#111', color: '#0f0', padding: 8 }}>{log.join('\n')}</div>
    </div>
  );
};

export default DebugDiagnostics;


