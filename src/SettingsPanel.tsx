// ================================================================
// SettingsPanel.tsx - 설정 탭
// API 키는 822 Link에서 내장 (변경 불가), 출력 설정만 관리
// ================================================================

import { useState, useEffect } from 'react';
import { Settings, HardDrive, FileText, Printer, RefreshCw, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import type { AppSettings } from './types';

export default function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.getAppSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    await window.electronAPI.saveAppSettings(settings);
    setSaveMsg('설정이 저장되었습니다.');
    setTimeout(() => setSaveMsg(null), 3000);
  };

  const handleCheckUpdate = async () => {
    const info = await window.electronAPI.checkForUpdates();
    if (info) {
      setSaveMsg(`새 버전 v${info.version}이 있습니다.`);
    } else {
      setSaveMsg('현재 최신 버전입니다.');
    }
    setTimeout(() => setSaveMsg(null), 5000);
  };

  if (!settings) {
    return <div className="p-6 text-slate-500">로딩 중...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Settings size={20} className="text-emerald-400" />
        설정
      </h2>

      {/* API 키 상태 (읽기 전용) */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Lock size={14} className="text-yellow-400" />
          Gemini AI API 키
        </h3>
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
          settings.geminiApiKey 
            ? 'bg-emerald-500/5 border-emerald-500/20' 
            : 'bg-red-500/5 border-red-500/20'
        }`}>
          {settings.geminiApiKey ? (
            <>
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <div>
                <div className="text-sm text-emerald-300 font-medium">API 키 연결됨</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {settings.geminiApiKey.slice(0, 8)}••••••••{settings.geminiApiKey.slice(-4)}
                </div>
              </div>
            </>
          ) : (
            <>
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <div>
                <div className="text-sm text-red-300 font-medium">API 키 없음</div>
                <div className="text-[11px] text-red-400/70">
                  API 키가 내장되어 있지 않습니다.
                </div>
              </div>
            </>
          )}
        </div>
        <p className="text-[10px] text-slate-600 mt-2">
          * API 키는 배포 시 앱 내에 내장됩니다. (사용자 수정 불가)
        </p>
      </div>

      {/* 출력 설정 */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Printer size={14} className="text-blue-400" />
          출력 설정
        </h3>

        <div className="space-y-4">
          {/* 용지 크기 */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">용지 크기</label>
            <div className="flex gap-2">
              {(['A4', 'B4'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => setSettings({ ...settings, paperSize: size })}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    settings.paperSize === size
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* 페이지당 문제 수 */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">페이지당 문제 수</label>
            <select
              value={settings.questionsPerPage}
              onChange={(e) => setSettings({ ...settings, questionsPerPage: parseInt(e.target.value) })}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value={2}>2문제 (1×2)</option>
              <option value={4}>4문제 (2×2)</option>
              <option value={6}>6문제 (2×3)</option>
            </select>
          </div>

          {/* 여백 */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">
              여백: {settings.marginMm}mm
            </label>
            <input
              type="range"
              min={5}
              max={30}
              value={settings.marginMm}
              onChange={(e) => setSettings({ ...settings, marginMm: parseInt(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          설정 저장
        </button>
      </div>

      {/* 데이터 & 앱 정보 */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <HardDrive size={14} className="text-purple-400" />
          앱 정보
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>버전</span>
            <span className="text-white font-mono">v1.0.0</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>데이터 경로</span>
            <span className="text-slate-500 text-xs font-mono truncate max-w-[300px]">{settings.dataPath}</span>
          </div>
        </div>
        <button
          onClick={handleCheckUpdate}
          className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
        >
          <RefreshCw size={14} />
          업데이트 확인
        </button>
      </div>

      {/* 저장 메시지 */}
      {saveMsg && (
        <div className="fixed bottom-6 right-6 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 shadow-xl text-sm text-emerald-400 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} />
          {saveMsg}
        </div>
      )}
    </div>
  );
}
