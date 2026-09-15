// ================================================================
// SettingsPanel.tsx - 설정 탭
// ================================================================

import { useState, useEffect, useRef } from 'react';
import { Settings, HardDrive, FileText, Printer, RefreshCw, CheckCircle2, AlertCircle, Lock, Folder, KeyRound, UserCircle } from 'lucide-react';
import type { AppSettings } from './types';
import { ChangePasswordModal } from './ChangePasswordModal';

interface SettingsPanelProps {
  token?: string;
}

export default function SettingsPanel({ token }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const originalSettingsRef = useRef<AppSettings | null>(null);
  const [appVersion, setAppVersion] = useState<string>('로딩 중...');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.getAppSettings().then(s => {
      setSettings(s);
      originalSettingsRef.current = s;
      if (s.academyLogoPath) {
        window.electronAPI.readImageAsBase64(s.academyLogoPath).then(setLogoPreviewUrl);
      }
    });
    window.electronAPI.getAppVersion().then(v => setAppVersion(`v${v}`));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    await window.electronAPI.saveAppSettings(settings);
    originalSettingsRef.current = settings;
    setSaveMsg('설정이 저장되었습니다.');
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const handleCheckUpdate = async () => {
    setSaveMsg('업데이트 확인 중...');
    try {
      const info = await window.electronAPI.checkForUpdates();
      const currentVersion = await window.electronAPI.getAppVersion();
      
      if (!info || info.version === currentVersion) {
        setSaveMsg('현재 최신 버전입니다.');
        setTimeout(() => setSaveMsg(null), 5000);
      } else {
        // 새 버전이 있으면 UpdaterModal이 팝업을 띄우므로 여기 메시지는 지움
        setSaveMsg(null);
      }
    } catch (e) {
      setSaveMsg('업데이트 확인에 실패했습니다.');
      setTimeout(() => setSaveMsg(null), 5000);
    }
  };

  const handleSelectStorageDir = async () => {
    const newDir = await window.electronAPI.selectSaveDir();
    if (newDir && settings) {
      setSettings({ ...settings, customStorageDir: newDir });
    }
  };

  const handleSelectLogo = async () => {
    const logoPath = await window.electronAPI.selectLogoImage();
    if (logoPath && settings) {
      setSettings({ ...settings, academyLogoPath: logoPath });
      const base64 = await window.electronAPI.readImageAsBase64(logoPath);
      setLogoPreviewUrl(base64);
    }
  };

  const handleClearLogo = () => {
    if (settings) {
      setSettings({ ...settings, academyLogoPath: undefined });
      setLogoPreviewUrl(null);
    }
  };

  if (!settings) {
    return <div className="p-6 text-slate-500">로딩 중...</div>;
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Settings size={20} className="text-indigo-600" />
            설정
          </h2>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-emerald-900/20 transition-all active:scale-95 flex items-center gap-2"
          >
            <CheckCircle2 size={16} />
            전체 설정 저장
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* 왼쪽 열 (Left Column) */}
          <div className="space-y-6">
            
            {/* 개인 계정 설정 */}
            <div className="bg-white shadow-sm border border-slate-100 rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <UserCircle size={14} className="text-blue-400" />
                개인 계정 설정
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                발급받은 초기 라이선스 비밀번호를 본인만의 안전한 비밀번호로 변경할 수 있습니다.
              </p>
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="px-4 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-600 text-sm font-medium transition-colors flex items-center gap-2"
              >
                <KeyRound size={16} className="text-indigo-500" />
                내 비밀번호 변경
              </button>
            </div>

            {/* 문제집 관리 탭 접근 보안 */}
            <div className="bg-white shadow-sm border border-slate-100 rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Lock size={14} className="text-red-400" />
                문제집 관리 탭 잠금
              </h3>
              <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                공용 컴퓨터 사용 시, 실수로 문제집이 삭제되거나 API 비용이 발생하는 것을 방지하기 위해 탭 접근을 제한합니다.
              </p>
              
              <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-sm text-slate-600 font-medium">잠금 기능 사용</span>
                <button 
                  onClick={() => {
                    const isEnabled = settings.isWorkbookLockEnabled || false;
                    const original = originalSettingsRef.current;
                    
                    if (isEnabled && original?.isWorkbookLockEnabled) {
                      // 이미 잠겨있는 상태에서 해제할 때 비밀번호 확인
                      const pass = window.prompt("잠금을 해제하려면 현재 접근 비밀번호를 입력하세요.");
                      if (pass === null) return; // 취소 누름
                      if (pass !== original.workbookTabPassword) {
                        alert("비밀번호가 일치하지 않습니다.");
                        return;
                      }
                    }
                    
                    setSettings({ 
                      ...settings, 
                      isWorkbookLockEnabled: !isEnabled,
                      // 해제 시 비밀번호도 초기화
                      workbookTabPassword: isEnabled ? '' : settings.workbookTabPassword
                    });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative ${settings.isWorkbookLockEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.isWorkbookLockEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              
              {settings.isWorkbookLockEnabled && (
                <div className="space-y-2 animate-fade-in border-t border-slate-800 pt-3">
                  <label className="block text-xs text-slate-500 font-medium">접근 비밀번호 (숫자 권장)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={settings.workbookTabPassword || ''}
                      onChange={(e) => {
                        const original = originalSettingsRef.current;
                        // 이미 저장된 잠금 비밀번호가 있는데 변경하려고 할 때 검증
                        if (original?.isWorkbookLockEnabled && original?.workbookTabPassword) {
                          const pass = window.prompt("비밀번호를 변경하려면 기존 비밀번호를 먼저 입력하세요.");
                          if (pass === null) return;
                          if (pass !== original.workbookTabPassword) {
                            alert("비밀번호가 일치하지 않습니다.");
                            return;
                          }
                          // 검증 통과 시 오리지널 상태를 풀어주어 연속 입력이 가능하도록 함
                          originalSettingsRef.current = { ...original, workbookTabPassword: '' };
                        }
                        setSettings({ ...settings, workbookTabPassword: e.target.value });
                      }}
                      placeholder="비밀번호 설정..."
                      className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                    />
                  </div>
                  <p className="text-[10px] text-amber-400/80 pt-1">
                    * 설정 변경 후 우측 상단의 <b>[전체 설정 저장]</b> 버튼을 꼭 눌러주세요.<br/>
                    * 주의: 이 비밀번호를 잊어버리면 문제집 탭에 접근할 수 없습니다.
                  </p>
                </div>
              )}
            </div>

            {/* API 키 설정 */}
            <div className="bg-white shadow-sm border border-slate-100 rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Lock size={14} className="text-yellow-400" />
                Gemini AI API 키
              </h3>
              <div className="space-y-3">
                <input
                  type="password"
                  value={settings.geminiApiKey}
                  onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                />
                <div className="flex items-center gap-2 px-1">
                  {settings.geminiApiKey ? (
                    <>
                      <CheckCircle2 size={14} className="text-indigo-600" />
                      <span className="text-xs text-indigo-600">API 키가 입력되어 있습니다.</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={14} className="text-red-400" />
                      <span className="text-xs text-red-400">API 키를 입력해주세요.</span>
                    </>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-4 bg-slate-50 p-2 rounded">
                * Google AI Studio에서 발급받은 Gemini API 키를 입력하세요.
              </p>
            </div>

            {/* 데이터 저장 경로 */}
            <div className="bg-white shadow-sm border border-slate-100 rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Folder size={14} className="text-amber-400" />
                데이터 저장 경로 및 폴더 스캔
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 text-sm font-mono truncate shadow-inner" title={settings.customStorageDir || settings.dataPath}>
                    {settings.customStorageDir || settings.dataPath}
                  </div>
                  <button
                    onClick={handleSelectStorageDir}
                    className="px-4 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 text-slate-800 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                  >
                    폴더 변경
                  </button>
                </div>
                
                <div className="pt-2">
                  <button
                    onClick={async () => {
                      setSaveMsg('외부 폴더 스캔 중...');
                      const res = await window.electronAPI.scanUnregisteredFolders();
                      if (res.success) {
                        if (res.addedWorkbooks > 0) {
                          alert(`스캔 완료: ${res.addedWorkbooks}개의 새로운 폴더를 감지하여 문제집으로 등록했습니다.\n'문제집 관리' 탭에서 확인하세요.`);
                        } else {
                          alert('새롭게 감지된 미등록 폴더가 없습니다.');
                        }
                        setSaveMsg(null);
                      } else {
                        alert(`스캔 실패: ${res.error}`);
                        setSaveMsg(null);
                      }
                    }}
                    className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <RefreshCw size={14} />
                    미등록 외부 폴더 스캔 및 연동
                  </button>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-3">
                  <div className="flex gap-2">
                    <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200/80 leading-relaxed">
                      <strong>주의:</strong> 경로를 변경하면 프로그램은 변경된 새 경로에서 데이터를 찾습니다. 기존 작업물을 유지하려면 윈도우 탐색기에서 예전 데이터를 새 폴더로 직접 옮겨주세요.<br/>
                      <strong>외부 폴더 복사 후:</strong> 다른 PC에서 가져온 이미지 폴더를 복사해 넣은 뒤, <b>[미등록 외부 폴더 스캔 및 연동]</b> 버튼을 눌러야 프로그램에 등록됩니다.
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* 오른쪽 열 (Right Column) */}
          <div className="space-y-6">
            
            {/* 출력 설정 */}
            <div className="bg-white shadow-sm border border-slate-100 rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Printer size={14} className="text-blue-400" />
                출력 설정
              </h3>

              <div className="space-y-6">
                {/* 1열: 용지 & 페이지 설정 */}
                <div className="grid grid-cols-2 gap-4">
                  {/* 용지 크기 */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-2 font-medium">용지 크기</label>
                    <div className="flex gap-2">
                      {(['A4', 'B4'] as const).map(size => (
                        <button
                          key={size}
                          onClick={() => setSettings({ ...settings, paperSize: size })}
                          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                            settings.paperSize === size
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-inner'
                              : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 페이지당 문제 수 */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-2 font-medium">페이지당 문제 수</label>
                    <select
                      value={settings.questionsPerPage}
                      onChange={(e) => setSettings({ ...settings, questionsPerPage: parseInt(e.target.value) })}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                    >
                      <option value={2}>2문제 (1×2)</option>
                      <option value={4}>4문제 (2×2)</option>
                      <option value={6}>6문제 (2×3)</option>
                    </select>
                  </div>
                </div>

                {/* 고속 스캔(병렬 처리) 모드 */}
                <div className="pt-2 border-t border-slate-200 mt-4">
                  <label className="block text-xs text-slate-500 mb-1.5 font-medium flex items-center justify-between">
                    <span>고속 스캔 (동시 분석 페이지 수)</span>
                    <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">유료 API 권장</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                    한 번에 여러 페이지를 동시에 분석하여 속도를 획기적으로 높입니다.<br/>
                    (주의: 구글 무료 티어 사용 시 3~5개로 설정하면 오류가 발생할 수 있습니다.)
                  </p>
                  <select
                    value={settings.concurrentScanLimit || 1}
                    onChange={(e) => setSettings({ ...settings, concurrentScanLimit: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                  >
                    <option value={1}>1페이지씩 (기본, 가장 안전함)</option>
                    <option value={2}>2페이지 동시 분석 (2배속)</option>
                    <option value={3}>3페이지 동시 분석 (3배속)</option>
                    <option value={5}>5페이지 동시 분석 (5배속 - 유료 전용)</option>
                  </select>
                </div>

                {/* 학원 커스텀 로고 */}
                <div className="pt-5 border-t border-slate-200">
                  <label className="block text-xs text-slate-500 mb-1.5 font-medium">
                    학원 전용 로고 / 전화번호 이미지
                  </label>
                  <p className="text-[11px] text-slate-500 mb-4 bg-slate-50 p-2 rounded leading-relaxed">
                    * 추천 사이즈: 가로 250px × 세로 50px (비율 5:1)<br/>투명 배경의 PNG 파일을 권장합니다. 출력 시 PDF 헤더 우측 상단에 고정 출력됩니다.
                  </p>
                  
                  <div className="flex items-center gap-3 mb-3">
                    <button
                      onClick={handleSelectLogo}
                      className="px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-white text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shadow-sm"
                    >
                      <Folder size={14} className="text-blue-400" />
                      이미지 파일 찾기
                    </button>
                    
                    {settings.academyLogoPath && (
                      <button
                        onClick={handleClearLogo}
                        className="px-3 py-2 text-xs text-red-400 bg-red-900/20 hover:bg-red-900/40 rounded transition-colors"
                      >
                        초기화
                      </button>
                    )}
                  </div>

                  <div className="w-full min-h-[80px] bg-white border border-slate-200 rounded-lg flex items-center justify-center p-4 relative overflow-hidden group">
                    {logoPreviewUrl ? (
                      <img src={logoPreviewUrl} alt="로고 미리보기" className="h-[40px] max-w-full object-contain" />
                    ) : (
                      <span className="text-sm text-slate-600">등록된 로고가 없습니다.</span>
                    )}
                  </div>
                  
                  {settings.academyLogoPath && (
                    <div className="mt-2 text-[10px] text-slate-500 font-mono truncate" title={settings.academyLogoPath}>
                      경로: {settings.academyLogoPath}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 데이터 & 앱 정보 */}
            <div className="bg-white shadow-sm border border-slate-100 rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <HardDrive size={14} className="text-purple-400" />
                앱 정보
              </h3>
              <div className="space-y-3 text-sm bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex justify-between items-center text-slate-500 border-b border-slate-800 pb-2">
                  <span>앱 버전</span>
                  <span className="text-slate-800 font-mono bg-slate-50 px-2 py-0.5 rounded">{appVersion}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 pt-1">
                  <span>기본 시스템 경로</span>
                  <span className="text-slate-500 text-[10px] font-mono truncate max-w-[200px]" title={settings.dataPath}>
                    {settings.dataPath}
                  </span>
                </div>
              </div>
              <button
                onClick={handleCheckUpdate}
                className="w-full mt-4 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 text-slate-800 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <RefreshCw size={14} className="text-slate-500" />
                소프트웨어 업데이트 확인
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* 저장 메시지 */}
      {saveMsg && (
        <div className="fixed bottom-6 right-6 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 shadow-xl text-sm text-indigo-600 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} />
          {saveMsg}
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      <ChangePasswordModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
        token={token || ''} 
      />
    </div>
  );
}
