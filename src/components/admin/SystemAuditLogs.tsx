import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Clock, 
  Search, 
  User, 
  FileText, 
  Lock, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { SystemLog } from '../../types';
import { getSystemLogs } from '../../services/db';

export const SystemAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const list = await getSystemLogs(60);
      setLogs(list);
    } catch (err) {
      console.error('Lỗi khi tải nhật ký hệ thống:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionBadge = (action: string) => {
    if (action.includes('EXAM')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <FileText className="w-3 h-3" /> {action}
        </span>
      );
    }
    if (action.includes('USER') || action.includes('ROLE')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <User className="w-3 h-3" /> {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
        <Clock className="w-3 h-3" /> {action}
      </span>
    );
  };

  const filteredLogs = logs.filter(l => 
    (l.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.actorEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.details || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-tight">
            Nhật ký Hoạt động & Kiểm toán Hệ thống
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Ghi nhận vết thay đổi dữ liệu, phân quyền tài khoản và các thao tác trọng yếu để đảm bảo tính an toàn
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="text-xs font-semibold px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer self-start sm:self-center"
        >
          Làm mới nhật ký
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm theo hành động, người thực hiện..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <span className="text-xs text-slate-500">
          {filteredLogs.length} bản ghi
        </span>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Hành động</th>
                <th className="py-3 px-4">Người thực hiện</th>
                <th className="py-3 px-4">Chi tiết thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {log.actorEmail}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-md truncate">
                      {log.details || '--'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-400 text-xs">
                    {isLoading ? 'Đang tải nhật ký...' : 'Chưa có bản ghi hoạt động nào.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
