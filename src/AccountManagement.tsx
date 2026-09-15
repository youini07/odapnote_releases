import React, { useState, useEffect } from 'react';
import { ShieldAlert, UserPlus, Save, Trash2, Loader2, Calendar, KeyRound, User, X } from 'lucide-react';

interface AppUser {
  id: string;
  username: string;
  role: string;
  expires_at: string;
}

interface AccountManagementProps {
  token: string;
}

export default function AccountManagement({ token }: AccountManagementProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // 새 계정 폼 상태
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // 연장 모달 상태
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendUserId, setExtendUserId] = useState('');
  const [extendDateInput, setExtendDateInput] = useState('');

  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch('https://bandadmin-auth-server-production.up.railway.app/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('유저 목록을 불러오지 못했습니다.');
      const data = await response.json();
      
      // 오답노트 전용 사용자만 필터링 (내부적으로 'odap_' 접두사 사용)
      const allUsers: AppUser[] = data.users || [];
      const odapUsers = allUsers.filter(u => u.username?.startsWith('odap_'));
      setUsers(odapUsers);
    } catch (err: any) {
      setErrorMsg(err.message || '유저 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) {
      alert('아이디와 비밀번호를 입력해주세요.');
      return;
    }
    
    setIsLoading(true);
    try {
      // 서버가 role 및 기타 필드를 무시하므로, 아이디에 접두사를 붙여서 격리
      const response = await fetch('https://bandadmin-auth-server-production.up.railway.app/api/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: `odap_${newUsername}`,
          password: newPassword
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '계정 생성 실패');
      }
      
      setNewUsername('');
      setNewPassword('');
      
      await fetchUsers();
    } catch (err: any) {
      alert('사용자 생성 실패: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    setIsLoading(true);
    try {
      const response = await fetch(`https://bandadmin-auth-server-production.up.railway.app/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('삭제 실패');
      await fetchUsers();
    } catch (err: any) {
      alert('삭제 실패: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const openExtendModal = (id: string, currentExpires: string | null) => {
    setExtendUserId(id);
    setExtendDateInput(currentExpires ? currentExpires.substring(0, 10) : '');
    setExtendModalOpen(true);
  };

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendDateInput) return;
    
    setExtendModalOpen(false);
    setIsLoading(true);
    try {
      const response = await fetch(`https://bandadmin-auth-server-production.up.railway.app/api/users/${extendUserId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ expires_at: extendDateInput })
      });
      if (!response.ok) throw new Error('연장 실패');
      await fetchUsers();
    } catch (err: any) {
      alert('연장 실패: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      <div className="flex items-center gap-3 text-indigo-600 border-b border-slate-800 pb-4 shrink-0">
        <ShieldAlert size={28} />
        <h1 className="text-2xl font-bold">오답노트 전용 라이선스 관리</h1>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-900/30 text-red-300 border border-red-800/50 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}

      {/* 새 계정 생성 폼 */}
      <div className="bg-white/50 border border-slate-800 rounded-xl p-6 shrink-0">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <UserPlus size={18} className="text-indigo-500" /> 신규 라이선스 발급
        </h2>
        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs text-slate-500 mb-1">아이디</label>
            <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 outline-none"
              placeholder="user01" />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs text-slate-500 mb-1">초기 비밀번호(키)</label>
            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 outline-none"
              placeholder="pass1234" />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button type="submit" disabled={isLoading}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : '계정 생성 (기본 30일 부여됨)'}
            </button>
          </div>
        </form>
        <p className="text-xs text-slate-500 mt-3">
          * 최초 생성 시 서버 정책에 따라 기본 30일이 부여됩니다. 생성 직후 아래 목록에서 <b>[기간 연장]</b>을 눌러 만료일을 수정해주세요.
        </p>
      </div>

      {/* 사용자 목록 */}
      <div className="bg-white/50 border border-slate-800 rounded-xl p-6 flex-1 overflow-hidden flex flex-col">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2 shrink-0">
          <User size={18} className="text-indigo-500" /> 오답노트 발급 계정 목록
        </h2>
        
        <div className="overflow-y-auto flex-1 pr-2">
          {isLoading && users.length === 0 ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" /></div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">아이디</th>
                  <th className="py-3 px-4">만료일</th>
                  <th className="py-3 px-4 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-500">등록된 계정이 없습니다.</td>
                  </tr>
                ) : (
                  users.map(user => {
                    const isExpired = user.expires_at ? new Date(user.expires_at) < new Date() : false;
                    // 'odap_' 접두사 제거 후 표시
                    const displayUsername = user.username.replace(/^odap_/, '');
                    
                    return (
                      <tr key={user.id} className="border-b border-slate-800/50 hover:bg-slate-50/20 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-700">{displayUsername}</td>
                        <td className="py-3 px-4">
                          <span className={`text-sm ${isExpired ? 'text-red-400 font-bold' : 'text-indigo-600'}`}>
                            {user.expires_at ? new Date(user.expires_at).toLocaleDateString('ko-KR') : '무제한'} {isExpired && '(만료됨)'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button onClick={() => openExtendModal(user.id, user.expires_at)} className="text-xs px-3 py-1.5 bg-blue-900/50 hover:bg-blue-800 text-blue-300 rounded transition-colors">
                            기간 연장
                          </button>
                          <button onClick={() => handleDeleteUser(user.id)} className="text-xs px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-300 rounded transition-colors">
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 기간 연장 모달 */}
      {extendModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">기간 연장</h3>
              <button onClick={() => setExtendModalOpen(false)} className="text-slate-500 hover:text-slate-800">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleExtendSubmit}>
              <div className="mb-6">
                <label className="block text-sm text-slate-500 mb-2">새로운 만료일 (YYYY-MM-DD)</label>
                <input
                  type="date"
                  value={extendDateInput}
                  onChange={(e) => setExtendDateInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExtendModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 bg-slate-50 hover:bg-slate-200 rounded-lg"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-slate-800 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
                >
                  변경 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
