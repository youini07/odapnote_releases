import React, { useState } from 'react';
import { AlertCircle, User, KeyRound, Loader2, GraduationCap } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string, username: string, role: string, expiresAt?: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState(() => localStorage.getItem('odapnote_saved_username') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('odapnote_saved_password') || '');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('odapnote_remember_me') === 'true');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // 밴드어드민 유저와 격리하기 위해 내부적으로 'odap_' 접두사 사용
      const loginUsername = username === 'youini07' ? username : `odap_${username}`;
      
      const response = await fetch('https://bandadmin-auth-server-production.up.railway.app/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '로그인에 실패했습니다. (아이디/비밀번호 확인)');
      }

      // Save credentials for next time if checked
      if (rememberMe) {
        localStorage.setItem('odapnote_saved_username', username);
        localStorage.setItem('odapnote_saved_password', password);
        localStorage.setItem('odapnote_remember_me', 'true');
      } else {
        localStorage.removeItem('odapnote_saved_username');
        localStorage.removeItem('odapnote_saved_password');
        localStorage.setItem('odapnote_remember_me', 'false');
      }



      // 만료일 정보 추출 시도 (다양한 응답 구조 대비)
      let expiresAt = data.expires_at 
        || data.expiresAt 
        || data.user?.expires_at 
        || data.user?.expiresAt 
        || null;

      // 응답 바디에 만료일이 없다면 JWT 토큰 페이로드(Payload)에서 추출 시도
      if (!expiresAt && data.token) {
        try {
          const payloadBase64 = data.token.split('.')[1];
          if (payloadBase64) {
             // atob는 한글 처리 문제가 있을 수 있으나, 만료일 영문 필드만 파싱할 때는 괜찮음
             const payload = JSON.parse(atob(payloadBase64));
             if (payload.expires_at) expiresAt = payload.expires_at;
             else if (payload.expiresAt) expiresAt = payload.expiresAt;
          }
        } catch(e) {
          console.error('JWT Token parse error:', e);
        }
      }

      // 만료일이 2030-12-31 (무제한 설정값)인 계정은 AI 분석 권한을 가진 'ai_user'로 취급
      const isPermanent = expiresAt && expiresAt.startsWith('2030-12-31');
      const userRole = username === 'youini07' 
        ? 'superadmin' 
        : (isPermanent ? 'ai_user' : 'user');

      // 로그인 성공
      onLoginSuccess(
        data.token,
        username,
        userRole,
        expiresAt
      );
      
    } catch (err: any) {
      setErrorMsg(err.message || '서버 통신에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center relative overflow-hidden font-sans">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      {/* Login Card (Glassmorphism) */}
      <div className="w-full max-w-md p-8 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl shadow-indigo-500/10 relative z-10 transition-all duration-300 transform">
        
        {/* Header Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-4">
            <GraduationCap size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">오답노트 관리자</h1>
        </div>

        {/* Error Message Alert */}
        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start animate-fade-in">
            <AlertCircle size={18} className="text-red-500 mr-2 mt-0.5 shrink-0" />
            <span className="text-red-600 text-sm leading-relaxed whitespace-pre-wrap">{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Username Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={18} className="text-slate-400" />
              </div>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm shadow-sm"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Password / License</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound size={18} className="text-slate-400" />
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호(라이선스 키)를 입력하세요"
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm shadow-sm"
              />
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center mt-2">
            <input
              type="checkbox"
              id="remember-me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-indigo-600 bg-white border-slate-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer accent-indigo-500"
            />
            <label htmlFor="remember-me" className="ml-2 text-sm text-slate-600 cursor-pointer select-none">
              아이디/비밀번호 기억
            </label>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={isLoading}
            className={`w-full py-3 mt-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center group ${isLoading ? 'opacity-70 cursor-not-allowed' : 'active:scale-[0.98]'}`}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin mr-2" />
                인증 중...
              </>
            ) : (
              '시스템 접속 (Login)'
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            라이선스 발급 및 연장은 관리자에게 문의하세요.<br/>
            &copy; 2026 OdapNote. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  );
}
