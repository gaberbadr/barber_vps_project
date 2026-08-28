import React, { useEffect, useState } from 'react';
import { getBookings, BookingDTO, BookingsFilterParams } from '../../api/admin.api';
import { updateBookingStatus, BookingStatus } from '../../api/bookings.api';
import { useToast } from '../../context/ToastContext';
import { parseApiError } from '../../utils/errorParser';
import './AdminBookings.css';

export default function AdminBookings() {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<BookingDTO[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Tracks which booking ID is currently being status-updated
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);

  const [filters, setFilters] = useState<BookingsFilterParams>({
    pageNumber: 1,
    pageSize: 10,
    date: '',
    status: '',
  });

  const fetchBookings = async (currentFilters: BookingsFilterParams) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const cleanFilters = Object.fromEntries(
        Object.entries(currentFilters).filter(([_, v]) => v !== '')
      );

      const response = await getBookings(cleanFilters);
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
      setBookings(items);
      setTotalCount(rawResponse?.totalCount ?? rawResponse?.TotalCount ?? items.length);
      setTotalPages(rawResponse?.totalPages ?? rawResponse?.TotalPages ?? 1);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      setBookings([]);
      setFetchError(parseApiError(error, 'السيرفر مش شغال دلوقتي. جرب تاني بعد شوية.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings(filters);
  }, [filters.pageNumber, filters.pageSize]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    setFilters(prev => ({ ...prev, pageNumber: 1 }));
    fetchBookings({ ...filters, pageNumber: 1 });
  };

  const handleClearFilters = () => {
    const cleared = { pageNumber: 1, pageSize: 10, date: '', status: '' };
    setFilters(cleared);
    fetchBookings(cleared);
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

  /** Quick-change booking status (Arrived / DidNotArrive) */
  const handleStatusChange = async (bookingId: string | number, status: BookingStatus) => {
    setUpdatingId(bookingId);
    try {
      await updateBookingStatus(Number(bookingId), status);
      const label = status === BookingStatus.Arrived ? 'حضر' : 'محضرش';
      showToast(`تم تحديث الحجز رقم ${bookingId} لـ ${label}`, 'success');
      // Refresh current page to reflect updated status
      fetchBookings(filters);
    } catch (err: any) {
      showToast(parseApiError(err, `فشل تحديث حالة الحجز رقم ${bookingId}.`), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':    return 'confirmed';
      case 'completed':    return 'completed';
      case 'cancelled':    return 'cancelled';
      case 'arrived':      return 'arrived';
      case 'didnotarrive': return 'didnotarrive';
      default:             return '';
    }
  };

  /** Determines which status actions are available for a given booking */
  const canMarkArrived     = (status: string) => !['arrived', 'didnotarrive', 'cancelled'].includes(status?.toLowerCase());
  const canMarkDidNotArrive = (status: string) => !['arrived', 'didnotarrive', 'cancelled'].includes(status?.toLowerCase());

  return (
    <div className="admin-bookings">
      <header className="admin-page-header">
        <h1>إدارة الحجوزات</h1>
      </header>

      <div className="filters-bar">
        <div className="filter-group">
          <label>التاريخ</label>
          <input
            type="date"
            name="date"
            value={filters.date || ''}
            onChange={handleFilterChange}
            onBlur={handleApplyFilters}
          />
        </div>

        <div className="filter-group">
          <label>الحالة</label>
          <select
            name="status"
            value={filters.status || ''}
            onChange={(e) => {
              handleFilterChange(e);
              setTimeout(() => fetchBookings({ ...filters, status: e.target.value, pageNumber: 1 }), 0);
            }}
          >
            <option value="">كل الحالات</option>
            <option value="Confirmed">مؤكد</option>
            <option value="Completed">مكتمل</option>
            <option value="Cancelled">ملغي</option>
            <option value="Arrived">حضر</option>
            <option value="DidNotArrive">محضرش</option>
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
              <th>رقم الحجز</th>
              <th>التاريخ والوقت</th>
              <th>العميل</th>
              <th>الحلاق</th>
              <th>الإجمالي</th>
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
                  <td><div className="skeleton-cell" style={{ width: '100px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '100px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '60px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '80px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '140px' }}></div></td>
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
            ) : bookings.length > 0 ? (
              bookings.map((booking) => {
                const isUpdating = updatingId === booking.id;
                return (
                  <tr key={booking.id}>
                    <td>#{booking.id}</td>
                    <td>{new Date(booking.bookingDate).toLocaleString()}</td>
                    <td>{booking.customerName}</td>
                    <td>{booking.barberName}</td>
                    <td>ج.م {booking.totalPrice.toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td>
                      <div className="booking-actions">
                        {canMarkArrived(booking.status) && (
                          <button
                            className="btn-status arrived"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(booking.id, BookingStatus.Arrived)}
                            title="سجل كحضور"
                          >
                            {isUpdating ? '…' : '✔ حضر'}
                          </button>
                        )}
                        {canMarkDidNotArrive(booking.status) && (
                          <button
                            className="btn-status didnotarrive"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(booking.id, BookingStatus.DidNotArrive)}
                            title="سجل كغياب"
                          >
                            {isUpdating ? '…' : '✖ محضرش'}
                          </button>
                        )}
                        {!canMarkArrived(booking.status) && !canMarkDidNotArrive(booking.status) && (
                          <span className="no-actions">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#8C867E' }}>
                  مفيش حجوزات.
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
