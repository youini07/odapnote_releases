// ================================================================
// App.tsx - 메인 앱 컴포넌트 + 4탭 네비게이션
// 다크 테마 기반 모던 UI (밴드어드민 스타일)
// ================================================================

import { useState, useEffect } from 'react';
import { BookOpen, Users, FileText, Settings, GraduationCap, ShieldAlert, LogOut } from 'lucide-react';
import WorkbookPanel from './WorkbookPanel';
import StudentPanel from './StudentPanel';
import OdapNotePanel from './OdapNotePanel';
import SettingsPanel from './SettingsPanel';
import UpdaterModal from './UpdaterModal';
import Login from './Login';
import AccountManagement from './AccountManagement';

// 탭 정의
type TabId = 'workbooks' | 'students' | 'odapnote' | 'settings' | 'account';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const baseTabs: Tab[] = [
  { id: 'workbooks', label: '문제집 관리', icon: <BookOpen size={20} />, description: 'PDF 업로드 및 문제 분석' },
  { id: 'students', label: '학생 관리', icon: <Users size={20} />, description: '학생 등록 및 기록 관리' },
  { id: 'odapnote', label: '오답노트 생성', icon: <FileText size={20} />, description: '맞춤형 오답노트 제작' },
  { id: 'settings', label: '설정', icon: <Settings size={20} />, description: 'API 키 및 앱 설정' },
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [username, setUsername] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<TabId>('workbooks');

  const handleLoginSuccess = (token: string, user: string, role: string, expires_at?: string) => {
    setAuthToken(token);
    setUsername(user);
    setUserRole(role);
    setExpiresAt(expires_at || null);
    setIsAuthenticated(true);
    setActiveTab(role === 'superadmin' || role === 'admin' ? 'account' : 'workbooks');
  };

  // 만약 로그인 성공 후 expiresAt이 없다면 추가 API로 갱신 시도
  useEffect(() => {
    if (isAuthenticated && !expiresAt && userRole !== 'superadmin' && userRole !== 'admin') {
      const fetchMyInfo = async () => {
        try {
          // 1. /api/users 시도 (모든 유저 목록)
          const res = await fetch('https://bandadmin-auth-server-production.up.railway.app/api/users', {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              const me = data.find((u: any) => u.username === `odap_${username}` || u.username === username);
              if (me && me.expires_at) {
                setExpiresAt(me.expires_at);
                return;
              }
            }
          }
          
          // 2. /api/users/me 시도 (단일 유저 정보)
          const resMe = await fetch('https://bandadmin-auth-server-production.up.railway.app/api/users/me', {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (resMe.ok) {
            const dataMe = await resMe.json();
            if (dataMe && dataMe.expires_at) {
              setExpiresAt(dataMe.expires_at);
            }
          }
        } catch (e) {
          console.error('Failed to fetch user expiration info', e);
        }
      };
      fetchMyInfo();
    }
  }, [isAuthenticated, expiresAt, authToken, username, userRole]);

  const handleLogout = () => {
    if(window.confirm('로그아웃 하시겠습니까?')) {
      setIsAuthenticated(false);
      setAuthToken('');
      setUsername('');
      setUserRole('user');
    }
  };

  // 로그인되지 않은 경우 로그인 화면 표시
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // 만료일 포맷팅
  const getExpirationText = () => {
    if (userRole === 'superadmin' || userRole === 'admin') return '무제한';
    if (!expiresAt) return '알 수 없음';
    
    const expireDate = new Date(expiresAt);
    const today = new Date();
    const isExpired = expireDate.getTime() < today.getTime();
    
    const formattedDate = expireDate.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    return isExpired ? `${formattedDate} (만료됨)` : formattedDate;
  };
  
  // 만료 여부 확인 로직 (스타일링용)
  const isLicenseExpired = () => {
    if (!expiresAt || userRole === 'superadmin' || userRole === 'admin') return false;
    return new Date(expiresAt).getTime() < new Date().getTime();
  };

  // 권한에 따른 탭 구성
  const tabs = [...baseTabs];
  if (userRole === 'superadmin' || userRole === 'admin') {
    tabs.push({ 
      id: 'account', 
      label: '계정(라이선스) 관리', 
      icon: <ShieldAlert size={20} />, 
      description: '슈퍼 관리자 전용 메뉴' 
    });
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden">
      {/* 헤더 */}
      <header className="shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* 로고 */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <GraduationCap size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              오답노트
            </h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-wider">
              ODAPNOTE v1.0.0
            </p>
          </div>
        </div>

        {/* 유저 정보 및 로그아웃 */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium text-slate-200">{username}님 환영합니다</div>
            <div className="flex items-center justify-end gap-2 text-[10px] mt-0.5">
              <span className="text-emerald-400 font-semibold">{userRole === 'superadmin' || userRole === 'admin' ? 'Super Admin' : 'Standard'}</span>
              <span className="text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50">
                만료일: <span className={isLicenseExpired() ? 'text-red-400' : 'text-slate-300 font-bold'}>{getExpirationText()}</span>
              </span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
            title="로그아웃"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* 메인 영역: 사이드바 + 컨텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 사이드바 네비게이션 */}
        <nav className="w-56 shrink-0 bg-slate-900/80 border-r border-slate-700/50 flex flex-col py-4 px-3 gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                group flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200
                ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/10 text-emerald-400 shadow-inner border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                }
              `}
            >
              <div className={`
                shrink-0 p-1.5 rounded-md transition-colors
                ${activeTab === tab.id
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-slate-500 group-hover:text-slate-300 group-hover:bg-slate-700/50'
                }
              `}>
                {tab.icon}
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-semibold truncate ${
                  activeTab === tab.id ? 'text-emerald-300' : ''
                }`}>
                  {tab.label}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {tab.description}
                </div>
              </div>
            </button>
          ))}

          {/* 하단 버전 정보 */}
          <div className="mt-auto pt-4 px-3 border-t border-slate-800">
            <p className="text-[10px] text-slate-600 text-center">
              OdapNote v1.0.0
            </p>
          </div>
        </nav>

        {/* 컨텐츠 영역 */}
        <main className="flex-1 overflow-y-auto bg-slate-950">
          {activeTab === 'workbooks' && <WorkbookPanel />}
          {activeTab === 'students' && <StudentPanel />}
          {activeTab === 'odapnote' && <OdapNotePanel />}
          {activeTab === 'settings' && <SettingsPanel token={authToken} />}
          {activeTab === 'account' && <AccountManagement token={authToken} />}
        </main>
      </div>

      <UpdaterModal />
    </div>
  );
}
