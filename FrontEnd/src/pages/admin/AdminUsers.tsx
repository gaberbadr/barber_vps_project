import React, { useEffect, useState } from 'react';
import { getUsers, blockUser, unblockUser, UserDTO, UsersFilterParams } from '../../api/admin.api';
import { parseApiError } from '../../utils/errorParser';
import './AdminUsers.css';

export default function AdminUsers() {
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filters, setFilters] = useState<UsersFilterParams>({
    pageNumber: 1,
    pageSize: 10,
    searchTerm: '',
    isActive: '',
  });

  const fetchUsers = async (currentFilters: UsersFilterParams) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const cleanFilters = Object.fromEntries(
        Object.entries(currentFilters).filter(([_, v]) => v !== '')
      );
      
      const response = await getUsers(cleanFilters);
      const rawResponse = response as any;
      
      const extractArray = (obj: any): any[] => {
        if (!obj) return [];
        if (Array.isArray(obj)) return obj;
        if (obj.$values && Array.isArray(obj.$values)) return obj.$values;
        if (obj.items) return extractArray(obj.items);
        if (obj.Items) return extractArray(obj.Items);
        if (obj.data) return extractArray(obj.data);
        if (obj.Data) return extractArray(obj.Data);
        return [];
      };
      
      const items = extractArray(rawResponse);
      setUsers(items);
      setTotalCount(rawResponse?.totalCount ?? rawResponse?.TotalCount ?? items.length);
      setTotalPages(rawResponse?.totalPages ?? rawResponse?.TotalPages ?? 1);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
      setFetchError(parseApiError(error, 'السيرفر مش شغال دلوقتي. جرب تاني بعد شوية.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(filters);
  }, [filters.pageNumber, filters.pageSize]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    setFilters(prev => ({ ...prev, pageNumber: 1 }));
    fetchUsers({ ...filters, pageNumber: 1 });
  };

  const handleClearFilters = () => {
    const cleared = { pageNumber: 1, pageSize: 10, searchTerm: '', isActive: '' };
    setFilters(cleared);
    fetchUsers(cleared);
  };

  const handlePrevPage = () => {
    if (filters.pageNumber! > 1) {
      setFilters(prev => ({ ...prev, pageNumber: prev.pageNumber! - 1 }));
    }
  };

  const handleNextPage = () => {
    if (filters.pageNumber! < totalPages) {
      setFilters(prev => ({ ...prev, pageNumber: prev.pageNumber! + 1 }));
    }
  };

  const handleToggleBlock = async (user: UserDTO) => {
    const actionEn = user.isActive ? 'block' : 'unblock';
    const actionAr = user.isActive ? 'تحظر' : 'تفك حظر';
    const confirmMessage = `متأكد إنك عايز ${actionAr} المستخدم ${user.fullName}؟`;
    
    if (window.confirm(confirmMessage)) {
      try {
        if (user.isActive) {
          await blockUser(user.id);
        } else {
          await unblockUser(user.id);
        }
        // Refresh current page
        fetchUsers(filters);
      } catch (error) {
        console.error(`Failed to ${actionEn} user`, error);
        alert(parseApiError(error, `فشل ${actionAr} المستخدم. جرب تاني.`));
      }
    }
  };

  return (
    <div className="admin-users">
      <header className="admin-page-header">
        <h1>إدارة المستخدمين</h1>
      </header>

      <div className="filters-bar">
        <div className="filter-group" style={{ flex: 1 }}>
          <label>بحث (بالاسم أو الإيميل)</label>
          <input 
            type="text" 
            name="searchTerm" 
            placeholder="مثلاً: أحمد محمد"
            value={filters.searchTerm || ''} 
            onChange={handleFilterChange} 
            onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
          />
        </div>
        
        <div className="filter-group">
          <label>الحالة</label>
          <select name="isActive" value={filters.isActive?.toString() || ''} onChange={(e) => { handleFilterChange(e); setTimeout(() => fetchUsers({ ...filters, isActive: e.target.value, pageNumber: 1 }), 0); }}>
            <option value="">كل المستخدمين</option>
            <option value="true">نشط</option>
            <option value="false">محظور</option>
          </select>
        </div>

        <button className="btn-clear-filters" onClick={handleClearFilters}>
          مسح الفلاتر
        </button>
      </div>

      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>الرقم</th>
              <th>الاسم بالكامل</th>
              <th>الإيميل</th>
              <th>التليفون</th>
              <th>تاريخ التسجيل</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="skeleton-row">
                  <td><div className="skeleton-cell" style={{ width: '40px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '120px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '150px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '100px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '100px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '60px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '80px' }}></div></td>
                </tr>
              ))
            ) : fetchError ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#EF5350', background: 'rgba(239, 83, 80, 0.05)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                    <span style={{ fontWeight: '500' }}>{fetchError}</span>
                  </div>
                </td>
              </tr>
            ) : users.length > 0 ? (
              users.map((user) => (
                <tr key={user.id}>
                  <td>#{user.id}</td>
                  <td>{user.fullName}</td>
                  <td>{user.email}</td>
                  <td>{user.phone || '-'}</td>
                  <td>{new Date(user.createdDate).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-badge ${user.isActive ? 'active' : 'blocked'}`}>
                      {user.isActive ? 'نشط' : 'محظور'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className={`btn-action ${user.isActive ? 'btn-block' : 'btn-unblock'}`}
                      onClick={() => handleToggleBlock(user)}
                    >
                      {user.isActive ? 'حظر' : 'فك الحظر'}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#8C867E' }}>
                  مفيش مستخدمين.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {!isLoading && totalCount > 0 && (
          <div className="pagination-container">
            <div className="pagination-info">
              عرض {(filters.pageNumber! - 1) * filters.pageSize! + 1} - {Math.min(filters.pageNumber! * filters.pageSize!, totalCount)} من {totalCount}
            </div>
            <div className="pagination-controls">
              <button 
                className="btn-page" 
                onClick={handlePrevPage} 
                disabled={filters.pageNumber! <= 1}
              >
                اللي فات
              </button>
              <button 
                className="btn-page" 
                onClick={handleNextPage} 
                disabled={filters.pageNumber! >= totalPages}
              >
                اللي جاي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
