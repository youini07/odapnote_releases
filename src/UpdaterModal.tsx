// ================================================================
// UpdaterModal.tsx - 자동 업데이트 UI 컴포넌트
// 밴드어드민의 UpdaterModal과 유사한 형태
// ================================================================

import { useState, useEffect } from 'react';
import { Download, CheckCircle2, AlertCircle, X, Loader2, RefreshCw } from 'lucide-react';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

export default function UpdaterModal() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [versionInfo, setVersionInfo] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 이벤트 리스너 등록
    const cleanupAvailable = window.electronAPI.onUpdaterEvent('update-available', (info) => {
      setStatus('available');
      setVersionInfo(info);
      setIsVisible(true);
    });

    const cleanupNotAvailable = window.electronAPI.onUpdaterEvent('update-not-available', () => {
      // 수동으로 체크했을 때만 보여주거나, 조용히 넘김
      setStatus('not-available');
    });

    const cleanupProgress = window.electronAPI.onUpdaterEvent('download-progress', (prog) => {
      setStatus('downloading');
      setProgress(prog.percent);
      setIsVisible(true);
    });

    const cleanupDownloaded = window.electronAPI.onUpdaterEvent('update-downloaded', () => {
      setStatus('downloaded');
      setIsVisible(true);
    });

    const cleanupError = window.electronAPI.onUpdaterEvent('updater-error', (err) => {
      setStatus('error');
      setErrorMsg(err);
      setIsVisible(true);
    });

    return () => {
      cleanupAvailable();
      cleanupNotAvailable();
      cleanupProgress();
      cleanupDownloaded();
      cleanupError();
    };
  }, []);

  const handleDownload = async () => {
    setStatus('downloading');
    setProgress(0);
    await window.electronAPI.downloadUpdate();
  };

  const handleInstall = async () => {
    await window.electronAPI.quitAndInstall();
  };

  const handleClose = () => {
    setIsVisible(false);
    // 다운로드 중이 아닐 때만 초기화
    if (status !== 'downloading') {
      setStatus('idle');
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-96 p-6 shadow-2xl relative overflow-hidden">
        {/* 상단 닫기 버튼 */}
        {status !== 'downloading' && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded transition-colors"
          >
            <X size={18} />
          </button>
        )}

        <div className="flex flex-col items-center text-center">
          {status === 'available' && (
            <>
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                <RefreshCw size={24} className="text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">새 업데이트 가능</h3>
              <p className="text-sm text-slate-400 mb-6">
                버전 {versionInfo?.version}이(가) 출시되었습니다. 업데이트하시겠습니까?
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  나중에
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  업데이트 다운로드
                </button>
              </div>
            </>
          )}

          {status === 'downloading' && (
            <>
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <Loader2 size={24} className="text-emerald-400 animate-spin" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">업데이트 다운로드 중...</h3>
              <p className="text-sm text-slate-400 mb-4">
                잠시만 기다려주세요. 백그라운드에서 다운로드됩니다.
              </p>
              
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-emerald-400 font-bold self-end">
                {Math.round(progress)}%
              </div>
            </>
          )}

          {status === 'downloaded' && (
            <>
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">다운로드 완료</h3>
              <p className="text-sm text-slate-400 mb-6">
                업데이트 준비가 완료되었습니다. 지금 재시작하여 설치하시겠습니까?
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  나중에 재시작
                </button>
                <button
                  onClick={handleInstall}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} />
                  지금 재시작
                </button>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle size={24} className="text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">업데이트 오류</h3>
              <p className="text-xs text-red-400/80 mb-6 bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-left w-full break-all">
                {errorMsg}
              </p>
              <button
                onClick={handleClose}
                className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium text-sm"
              >
                닫기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
