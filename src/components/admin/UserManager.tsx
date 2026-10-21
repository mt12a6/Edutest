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
  Upload,
  UserPlus,
  KeyRound,
  Trash2,
  Edit2,
  X,
  Check
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import { 
  getAllUsers, 
  updateUserRole, 
  toggleUserStatus, 
  createUserProfile,
  updateUserProfile,
  deleteUserProfile,
  resetUserPassword,
  logSystemAction 
} from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { BulkUserUploadModal } from './BulkUserUploadModal';

export const UserManager: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState<boolean>(false);

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '123456',
    role: 'student' as UserRole,
    className: '10A1'
  });

  const [resetPasswordModalUser, setResetPasswordModalUser] = useState<UserProfile | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('123456');

  const [deleteModalUser, setDeleteModalUser] = useState<UserProfile | null>(null);

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

  const showSuccessMsg = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const showErrorMsg = (msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError(null), 4000);
  };

  // Open add new user modal
  const handleOpenAddUser = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      displayName: '',
      email: '',
      password: '123456',
      role: 'student',
      className: '10A1'
    });
    setShowAddEditModal(true);
  };

  // Open edit user modal
  const handleOpenEditUser = (u: UserProfile) => {
    setEditingUser(u);
    setFormData({
      username: u.username || u.id,
      displayName: u.displayName || '',
      email: u.email || '',
      password: u.password || '123456',
      role: u.role,
      className: u.className || '10A1'
    });
    setShowAddEditModal(true);
  };

  // Save add/edit
  const handleSaveUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.displayName.trim()) {
      showErrorMsg('Vui lòng nhập đầy đủ tên đăng nhập và họ tên.');
      return;
    }

    try {
      if (editingUser) {
        // Update existing
        await updateUserProfile(editingUser.id, {
          username: formData.username.trim(),
          displayName: formData.displayName.trim(),
          email: formData.email.trim(),
          role: formData.role,
          className: formData.className,
          classIds: [formData.className],
          password: formData.password
        });
        showSuccessMsg(`Đã cập nhật thông tin tài khoản "${formData.displayName}".`);
      } else {
        // Create new
        await createUserProfile({
          username: formData.username.trim(),
          displayName: formData.displayName.trim(),
          email: formData.email.trim() || `${formData.username.trim()}@edutest.edu.vn`,
          password: formData.password || '123456',
          role: formData.role,
          className: formData.className,
          classIds: [formData.className]
        });
        showSuccessMsg(`Đã thêm thành công tài khoản mới: "${formData.displayName}" (Mật khẩu: ${formData.password}).`);
      }
      setShowAddEditModal(false);
      fetchUsers();
    } catch (err: any) {
      showErrorMsg('Có lỗi xảy ra: ' + (err?.message || 'Không thể lưu tài khoản'));
    }
  };

  // Handle reset password
  const handleConfirmResetPassword = async () => {
    if (!resetPasswordModalUser) return;
    try {
      await resetUserPassword(resetPasswordModalUser.id, newPasswordInput);
      showSuccessMsg(`Đã đặt lại mật khẩu cho tài khoản "${resetPasswordModalUser.displayName || resetPasswordModalUser.email}" thành: "${newPasswordInput}".`);
      setResetPasswordModalUser(null);
      fetchUsers();
    } catch (err: any) {
      showErrorMsg('Lỗi đặt lại mật khẩu: ' + err?.message);
    }
  };

  // Handle delete user
  const handleConfirmDelete = async () => {
    if (!deleteModalUser) return;
    try {
      await deleteUserProfile(deleteModalUser.id);
      showSuccessMsg(`Đã xóa tài khoản "${deleteModalUser.displayName || deleteModalUser.email}".`);
      setDeleteModalUser(null);
      fetchUsers();
    } catch (err: any) {
      showErrorMsg('Lỗi khi xóa tài khoản: ' + err?.message);
    }
  };

  const handleRoleChange = async (targetUser: UserProfile, newRole: UserRole) => {
    try {
      await updateUserRole(targetUser.id, newRole);
      showSuccessMsg(`Đã cập nhật vai trò của ${targetUser.displayName || targetUser.email} thành "${newRole}".`);
      fetchUsers();
    } catch (err) {
      console.error('Lỗi cập nhật vai trò:', err);
    }
  };

  const handleToggleStatus = async (targetUser: UserProfile) => {
    const nextStatus = targetUser.status === 'active' ? 'disabled' : 'active';
    try {
      await toggleUserStatus(targetUser.id, nextStatus);
      showSuccessMsg(`Đã ${nextStatus === 'active' ? 'kích hoạt lại' : 'khóa tạm thời'} tài khoản ${targetUser.displayName || targetUser.email}.`);
      fetchUsers();
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái tài khoản:', err);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
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
            Quản trị Tài khoản Người dùng & Phân quyền
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Thêm mới, chỉnh sửa thông tin, đặt lại mật khẩu, phân quyền giáo viên và học sinh
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center flex-wrap">
          <button
            onClick={handleOpenAddUser}
            className="text-xs font-bold px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm tài khoản mới</span>
          </button>

          <button
            onClick={() => setShowBulkUpload(true)}
            className="text-xs font-bold px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-colors cursor-pointer flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>Nhập Excel/CSV</span>
          </button>

          <button
            onClick={fetchUsers}
            className="text-xs font-semibold px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Làm mới
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm theo tên, username, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
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
          Tổng số: <strong>{filteredUsers.length}</strong> tài khoản
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Tên người dùng</th>
                <th className="py-3 px-4">Tên đăng nhập / Email</th>
                <th className="py-3 px-4">Lớp</th>
                <th className="py-3 px-4">Vai trò</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
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
                          <div>
                            <span className="block font-bold">{u.displayName || 'Người dùng'}</span>
                            {u.password && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                Pass: •••••• ({u.password})
                              </span>
                            )}
                          </div>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
                              Bạn
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="font-mono font-semibold text-slate-900 block">{u.username || u.id}</span>
                        <span className="text-[11px] text-slate-400">{u.email}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-semibold">
                        {u.className || u.classIds?.[0] || '--'}
                      </td>
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
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit info */}
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Chỉnh sửa thông tin tài khoản"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setResetPasswordModalUser(u);
                              setNewPasswordInput('123456');
                            }}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                            title="Đặt lại mật khẩu"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Toggle status */}
                          <button
                            disabled={isSelf}
                            onClick={() => handleToggleStatus(u)}
                            className={`p-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-30 ${
                              isDisabled 
                                ? 'text-emerald-700 hover:bg-emerald-50' 
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title={isDisabled ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                          >
                            {isDisabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          </button>

                          {/* Delete account */}
                          <button
                            disabled={isSelf}
                            onClick={() => setDeleteModalUser(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-20"
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Không tìm thấy tài khoản nào phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD / EDIT USER */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingUser ? `Chỉnh sửa: ${editingUser.displayName}` : 'Thêm tài khoản người dùng mới'}
              </h3>
              <button 
                onClick={() => setShowAddEditModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserForm} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên đăng nhập (Username): <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: hocsinh02, nguyenvana..."
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Họ và tên hiển thị: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email liên kết (tùy chọn):
                </label>
                <input
                  type="email"
                  placeholder="Ví dụ: an.nguyen@thpt.edu.vn"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mật khẩu:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Mặc định: 123456"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Vai trò:
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white font-medium"
                  >
                    <option value="student">Học sinh</option>
                    <option value="teacher">Giáo viên</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lớp học:
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 10A1, 6A2..."
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                >
                  {editingUser ? 'Cập nhật tài khoản' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESET PASSWORD */}
      {resetPasswordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Đặt lại mật khẩu
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tài khoản: {resetPasswordModalUser.displayName || resetPasswordModalUser.username}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block font-semibold text-slate-700">
                Nhập mật khẩu mới:
              </label>
              <input
                type="text"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="123456"
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-amber-500 bg-white"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewPasswordInput('123456')}
                  className="text-[11px] text-indigo-600 underline font-semibold"
                >
                  Đặt về mặc định: 123456
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setResetPasswordModalUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmResetPassword}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs"
              >
                Xác nhận đổi mật khẩu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deleteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-900 text-base">
                Xác nhận xóa tài khoản?
              </h3>
              <p className="text-xs text-slate-500">
                Bạn có chắc chắn muốn xóa tài khoản <strong>{deleteModalUser.displayName || deleteModalUser.username}</strong> ({deleteModalUser.email})? Thao tác này không thể hoàn tác.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <BulkUserUploadModal
          isOpen={showBulkUpload}
          onClose={() => {
            setShowBulkUpload(false);
            fetchUsers();
          }}
          onSuccess={fetchUsers}
        />
      )}

    </div>
  );
};
