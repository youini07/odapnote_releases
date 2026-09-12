import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import WorkbookPanel from './WorkbookPanel';

interface Props {
  isUnlocked: boolean;
  onUnlock: () => void;
}

export default function WorkbookLockGuard({ isUnlocked, onUnlock }: Props) {
  const [password, setPassword] = useState('');
  const [expectedPassword, setExpectedPassword] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLockEnabled, setIsLockEnabled] = useState(false);

  useEffect(() => {
    if (isUnlocked) return; // 이미 해제된 경우 설정 불러올 필요 없음

    window.electronAPI.getAppSettings().then(settings => {
      if (settings.isWorkbookLockEnabled && settings.workbookTabPassword) {
        setExpectedPassword(settings.workbookTabPassword);
        setIsLockEnabled(true);
      } else {
        setIsLockEnabled(false);
      }
      setIsChecking(false);
    });
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === expectedPassword) {
      onUnlock();
    } else {
      setErrorMsg('비밀번호가 일치하지 않습니다.');
      setPassword('');
    }
  };

  // 이미 해제된 상태면 WorkbookPanel 렌더링
  if (isUnlocked) {
    return <WorkbookPanel />;
  }

  if (isChecking) return null;

  // 잠금 기능이 비활성화된 경우에도 WorkbookPanel 렌더링
  if (!isLockEnabled) {
    return <WorkbookPanel />;
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-950 p-6 animate-fade-in">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/50 rounded-2xl p-8 shadow-2xl flex flex-col items-center">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-700">
          <Lock size={28} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">문제집 관리 탭 잠김</h2>
        <p className="text-sm text-slate-400 text-center mb-8">
          원장님이 설정한 비밀번호를 입력해야 이 페이지에 접근할 수 있습니다.
        </p>
        <form onSubmit={handleUnlock} className="w-full space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMsg('');
              }}
              placeholder="비밀번호 입력..."
              autoFocus
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-center text-white text-lg tracking-widest focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
            />
            {errorMsg && <p className="text-red-400 text-xs mt-2 text-center">{errorMsg}</p>}
          </div>
          <button 
            type="submit"
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
          >
            잠금 해제
          </button>
        </form>
      </div>
    </div>
  );
}
