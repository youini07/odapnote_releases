// ================================================================
// App.tsx - 메인 앱 컴포넌트 + 4탭 네비게이션
// 다크 테마 기반 모던 UI (밴드어드민 스타일)
// ================================================================

import { useState } from 'react';
import { BookOpen, Users, FileText, Settings, GraduationCap } from 'lucide-react';
import WorkbookPanel from './WorkbookPanel';
import StudentPanel from './StudentPanel';
import OdapNotePanel from './OdapNotePanel';
import SettingsPanel from './SettingsPanel';
import UpdaterModal from './UpdaterModal';

// 탭 정의
type TabId = 'workbooks' | 'students' | 'odapnote' | 'settings';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const tabs: Tab[] = [
  { id: 'workbooks', label: '문제집 관리', icon: <BookOpen size={20} />, description: 'PDF 업로드 및 문제 분석' },
  { id: 'students', label: '학생 관리', icon: <Users size={20} />, description: '학생 등록 및 기록 관리' },
  { id: 'odapnote', label: '오답노트 생성', icon: <FileText size={20} />, description: '맞춤형 오답노트 제작' },
  { id: 'settings', label: '설정', icon: <Settings size={20} />, description: 'API 키 및 앱 설정' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('workbooks');

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden">
      {/* 헤더 */}
      <header className="shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 px-6 py-3">
        <div className="flex items-center justify-between">
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
          {activeTab === 'settings' && <SettingsPanel />}
        </main>
      </div>

      <UpdaterModal />
    </div>
  );
}
