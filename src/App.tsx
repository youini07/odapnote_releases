import type { AppSettings } from './types';
// ================================================================
// App.tsx - 메인 앱 컴포넌트 + 사이드바 네비게이션
// 라이트(Light) 테마 기반 프리미엄 SaaS UI (퍼플/인디고 중심)
// ================================================================

import { useState, useEffect } from 'react';
import { 
  Home, Users, Layers, FileCheck, Library, 
  Files, School, Calendar, Settings, ShieldAlert, LogOut, Divide
} from 'lucide-react';
import WorkbookPanel from './WorkbookPanel';
import WorkbookLockGuard from './WorkbookLockGuard';
import StudentPanel from './StudentPanel';
import OdapNotePanel from './OdapNotePanel';
import SettingsPanel from './SettingsPanel';
import UpdaterModal from './UpdaterModal';
import Login from './Login';
import AccountManagement from './AccountManagement';
import PlaceholderPanel from './PlaceholderPanel';
import LibraryPanel from './LibraryPanel';

// 탭 정의
type TabId = 'dashboard' | 'students' | 'classes' | 'ai_analysis' | 'workbooks' | 'library' | 'materials' | 'school_exams' | 'csat_exams' | 'settings' | 'account';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const baseTabs: Tab[] = [
  { id: 'dashboard', label: '대시보드', icon: <Home size={18} />, description: '전체 현황 요약' },
  { id: 'students', label: '학생', icon: <Users size={18} />, description: '학생 등록 및 기록 관리' },
  { id: 'classes', label: '반·과정', icon: <Layers size={18} />, description: '반별 수업 구조' },
  { id: 'ai_analysis', label: '문제집 AI 분석', icon: <FileCheck size={18} />, description: '문제집 PDF 자동 분석' },
  { id: 'workbooks', label: '오답노트 작업', icon: <FileCheck size={18} />, description: '문제집 및 오답노트 생성' },
  { id: 'library', label: '라이브러리', icon: <Library size={18} />, description: '교재 원본 및 분석 관리' },
  { id: 'materials', label: '자료·시험지', icon: <Files size={18} />, description: '학원 자체 시험지' },
  { id: 'school_exams', label: '학교 기출', icon: <School size={18} />, description: '주변 학교 기출문제' },
  { id: 'csat_exams', label: '수능·모의고사', icon: <Calendar size={18} />, description: '전국연합 평가 자료' },
  { id: 'settings', label: '설정', icon: <Settings size={18} />, description: 'API 키 및 앱 설정' },
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [username, setUsername] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isWorkbookUnlocked, setIsWorkbookUnlocked] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    window.electronAPI.getAppSettings().then(setSettings);
  }, []);


  const handleLoginSuccess = (token: string, user: string, role: string, expires_at?: string) => {
    setAuthToken(token);
    setUsername(user);
    setUserRole(role);
    setExpiresAt(expires_at || null);
    setIsAuthenticated(true);
    setActiveTab(role === 'superadmin' || role === 'admin' ? 'account' : 'dashboard');
  };

  useEffect(() => {
    if (isAuthenticated && !expiresAt && userRole !== 'superadmin' && userRole !== 'admin') {
      const fetchMyInfo = async () => {
        try {
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
      setIsWorkbookUnlocked(false);
    }
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const getExpirationText = () => {
    if (userRole === 'superadmin' || userRole === 'admin') return '무제한';
    if (!expiresAt) return '알 수 없음';
    const expireDate = new Date(expiresAt);
    const today = new Date();
    const isExpired = expireDate.getTime() < today.getTime();
    const formattedDate = expireDate.toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    return isExpired ? `${formattedDate} (만료됨)` : formattedDate;
  };
  
  const isLicenseExpired = () => {
    if (!expiresAt || userRole === 'superadmin' || userRole === 'admin') return false;
    return new Date(expiresAt).getTime() < new Date().getTime();
  };

  const tabs = [...baseTabs];
  if (userRole === 'superadmin' || userRole === 'admin') {
    tabs.push({ 
      id: 'account', 
      label: '계정(라이선스) 관리', 
      icon: <ShieldAlert size={18} />, 
      description: '슈퍼 관리자 전용 메뉴' 
    });
  }

  const filteredTabs = tabs.filter(t => {
    if (t.id === 'account' && (userRole !== 'superadmin' && userRole !== 'admin')) return false;
    if (t.id === 'settings' && (userRole !== 'superadmin' && userRole !== 'admin')) return false;
    if (t.id === 'school_exams' && !settings?.showTabSchool) return false;
    if (t.id === 'csat_exams' && !settings?.showTabSuneung) return false;
    if (t.id === 'materials' && !settings?.showTabMaterial) return false;
    
    // AI 분석 탭은 권한이 없으면 숨김
    if (t.id === 'ai_analysis' && (userRole !== 'superadmin' && userRole !== 'admin' && userRole !== 'ai_user')) return false;
    
    return true;
  });

  const activeTabData = filteredTabs.find(t => t.id === activeTab);

  return (
    <div className="h-screen flex bg-slate-200 text-slate-800 font-sans overflow-hidden print:h-auto print:overflow-visible print:bg-white print:block">
      
      {/* 둥근 플로팅 사이드바 */}
      <aside className="w-64 shrink-0 bg-slate-100 m-4 mr-2 rounded-2xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] border border-slate-300 flex flex-col overflow-hidden print-hide">
        
        {/* 상단 로고 영역 */}
        <div className="p-6 pb-2 shrink-0 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white font-bold text-lg leading-none transform -translate-y-px">∞</span>
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
                ODAPNOTE
              </h1>
              <p className="text-[10px] text-indigo-500 font-semibold tracking-wider uppercase">
                v1.0.0
              </p>
            </div>
          </div>
        </div>

        {/* 탭 리스트 */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          {filteredTabs.map(tab => {

            return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                w-full group flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200
                ${activeTab === tab.id
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }
              `}
            >
              <div className={`
                shrink-0 transition-colors
                ${activeTab === tab.id
                  ? 'text-indigo-600'
                  : 'text-slate-400 group-hover:text-indigo-400'
                }
              `}>
                {tab.icon}
              </div>
              <div className="min-w-0">
                <div className={`text-[13px] font-bold truncate ${
                  activeTab === tab.id ? 'text-indigo-700' : 'text-slate-600'
                }`}>
                  {tab.label}
                </div>
              </div>
            </button>
            );
          })}
        </nav>

        {/* 하단 프로필/계정 */}
        <div className="shrink-0 p-4 border-t border-slate-300">
          <div className="flex items-center gap-3 bg-slate-200 p-3 rounded-xl border border-slate-300">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-800 truncate">{username}</div>
              <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                <span className="bg-indigo-100 text-indigo-700 px-1.5 rounded-full font-semibold">{userRole === 'superadmin' || userRole === 'admin' ? 'Admin' : 'Std'}</span>
                <span className={`truncate ${isLicenseExpired() ? 'text-red-500' : ''}`}>{getExpirationText()}</span>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
              title="로그아웃"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 m-4 ml-2 bg-transparent flex flex-col overflow-hidden relative print:m-0 print:overflow-visible print:block">
        {/* 상단 헤더 바 (네비게이션/검색 등 위치) */}
        <header className="h-14 shrink-0 bg-slate-100 rounded-2xl shadow-sm border border-slate-300 flex items-center justify-between px-6 mb-4 print-hide">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 font-medium">{settings?.academyName || '전과목 개인별 학습 솔루션'}</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800 font-bold">{activeTabData?.label}</span>
          </div>
        </header>

        {/* 뷰 포트 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl bg-slate-100 shadow-sm border border-slate-300 print:overflow-visible print:border-none print:shadow-none print:bg-transparent print:block">
          {activeTab === 'dashboard' && <PlaceholderPanel title="대시보드" description="전체 현황을 한눈에 파악하세요." />}
          {activeTab === 'students' && <StudentPanel />}
          {activeTab === 'classes' && <PlaceholderPanel title="반·과정" description="수업 및 학생 소속을 관리하세요." />}
          
          {activeTab === 'ai_analysis' && (
            <div className="flex flex-col relative h-full">
              <WorkbookLockGuard isUnlocked={isWorkbookUnlocked} onUnlock={() => setIsWorkbookUnlocked(true)} />
            </div>
          )}
          
          {activeTab === 'workbooks' && (
            <div className="flex flex-col relative h-full">
              <OdapNotePanel />
            </div>
          )}
          {activeTab === 'library' && <LibraryPanel />}
          {activeTab === 'materials' && <PlaceholderPanel title="자료·시험지" description="학원 자체 시험지를 관리하세요." />}
          {activeTab === 'school_exams' && <PlaceholderPanel title="학교 기출" description="주변 학교 기출문제를 관리하세요." />}
          {activeTab === 'csat_exams' && <PlaceholderPanel title="수능·모의고사" description="전국연합 평가 자료를 관리하세요." />}
          {activeTab === 'settings' && <SettingsPanel token={authToken} onSettingsChange={setSettings} />}
          {activeTab === 'account' && <AccountManagement token={authToken} />}
        </div>
      </main>

      <UpdaterModal />
    </div>
  );
}
