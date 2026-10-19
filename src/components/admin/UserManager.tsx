import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  GraduationCap, 
  UserCheck, 
  Lock, 
  Unlock, 
  Search, 
  AlertTriangle,
  CheckCircle2,
  Filter,
  Upload
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import { getAllUsers, updateUserRole, toggleUserStatus, logSystemAction } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { BulkUserUploadModal } from './BulkUserUploadModal';

export const UserManager: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState<boolean>(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const list = await getAllUsers();
      setUsers(list);
    } catch (err) {
      console.error('Lỗi khi tải danh sách người dùng:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (targetUser: UserProfile, newRole: UserRole) => {
    try {
      await updateUserRole(targetUser.id, newRole);
      await logSystemAction(
        'CHANGE_USER_ROLE',
        user?.uid || 'admin',
        user?.email || 'admin',
        targetUser.id,
        'user',
        `Cập nhật vai trò người dùng ${targetUser.email} thành ${newRole}`
      );
      setActionSuccess(`Đã cập nhật vai trò của ${targetUser.displayName || targetUser.email} thành "${newRole}".`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchUsers();
    } catch (err) {
      console.error('Lỗi cập nhật vai trò:', err);
    }
  };

  const handleToggleStatus = async (targetUser: UserProfile) => {
    const nextStatus = targetUser.status === 'active' ? 'disabled' : 'active';
    try {
      await toggleUserStatus(targetUser.id, nextStatus);
      await logSystemAction(
        'TOGGLE_USER_STATUS',
        user?.uid || 'admin',
        user?.email || 'admin',
        targetUser.id,
        'user',
        `${nextStatus === 'active' ? 'Kích hoạt' : 'Khóa'} tài khoản ${targetUser.email}`
      );
      setActionSuccess(`Đã ${nextStatus === 'active' ? 'kích hoạt lại' : 'khóa tạm thời'} tài khoản ${targetUser.displayName || targetUser.email}.`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchUsers();
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái tài khoản:', err);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-tight">
            Quản trị Người dùng & Phân quyền
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý tài khoản giáo viên, học sinh, phân định quyền truy cập và bảo vệ an ninh hệ thống
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="text-xs font-bold px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>Tải lên danh sách Excel/CSV</span>
          </button>

          <button
            onClick={fetchUsers}
            className="text-xs font-semibold px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Làm mới danh sách
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700"
          >
            <option value="all">Tất cả vai trò</option>
            <option value="admin">Quản trị viên (Admin)</option>
            <option value="teacher">Giáo viên (Teacher)</option>
            <option value="student">Học sinh (Student)</option>
          </select>
        </div>

        <span className="text-xs text-slate-500">
          Tổng số: <strong>{filteredUsers.length}</strong> người dùng
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Người dùng</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Vai trò hiện tại</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4">Phân quyền vai trò</th>
                <th className="py-3 px-4 text-right">Khóa / Mở</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const isSelf = u.id === user?.uid;
                  const isDisabled = u.status === 'disabled';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" className="w-7 h-7 rounded-full object-cover border" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                              {(u.displayName || u.email || 'U')[0].toUpperCase()}
                            </div>
                          )}
                          <span>{u.displayName || 'Người dùng'}</span>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
                              Bạn
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{u.email}</td>
                      <td className="py-3 px-4">
                        {u.role === 'admin' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <ShieldCheck className="w-3 h-3" /> Quản trị viên
                          </span>
                        )}
                        {u.role === 'teacher' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <GraduationCap className="w-3 h-3" /> Giáo viên
                          </span>
                        )}
                        {u.role === 'student' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <UserCheck className="w-3 h-3" /> Học sinh
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isDisabled ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isDisabled ? 'Bị khóa' : 'Hoạt động'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 bg-white font-medium text-slate-700 cursor-pointer"
                        >
                          <option value="student">Học sinh (Student)</option>
                          <option value="teacher">Giáo viên (Teacher)</option>
                          <option value="admin">Quản trị viên (Admin)</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          disabled={isSelf}
                          onClick={() => handleToggleStatus(u)}
                          className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-30 ${
                            isDisabled 
                              ? 'text-emerald-700 hover:bg-emerald-50' 
                              : 'text-rose-600 hover:bg-rose-50'
                          }`}
                          title={isDisabled ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                        >
                          {isDisabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                    {isLoading ? 'Đang tải người dùng...' : 'Không có người dùng nào phù hợp.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showBulkUpload && (
        <BulkUserUploadModal
          isOpen={showBulkUpload}
          onClose={() => setShowBulkUpload(false)}
          onSuccess={() => {
            setActionSuccess('Đã nhập danh sách tài khoản thành công!');
            setTimeout(() => setActionSuccess(null), 4000);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
};
