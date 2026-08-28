import { useState, useEffect } from 'react';
import { getUpcomingBookings, getBookingHistory, cancelBooking, BookingDTO } from '../../api/bookings.api';
import { useToast } from '../../context/ToastContext';
import { parseApiError } from '../../utils/errorParser';
import { formatTime12Hour } from '../../utils/timeFormat';
import './MyBookings.css';

export default function MyBookings() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [upcoming, setUpcoming] = useState<BookingDTO[]>([]);
  const [history, setHistory] = useState<BookingDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Pagination for history
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { showToast } = useToast();

  const fetchUpcoming = async () => {
    try {
      const data = await getUpcomingBookings();
      setUpcoming(data);
    } catch (error) {
      console.error('Failed to fetch upcoming bookings', error);
      showToast('مش قادرين نحمل حجوزاتك الجاية', 'error');
    }
  };

  const fetchHistory = async (pageNumber: number) => {
    try {
      const data = await getBookingHistory(pageNumber, 10);
      setHistory(data.items);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Failed to fetch booking history', error);
      showToast('مش قادرين نحمل سجل حجوزاتك', 'error');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      if (activeTab === 'upcoming') {
        await fetchUpcoming();
      } else {
        await fetchHistory(page);
      }
      setIsLoading(false);
    };
    loadData();
  }, [activeTab, page]);

  const handleCancel = async (bookingId: number) => {
    if (!window.confirm('متأكد إنك عايز تلغي الحجز ده؟ مش هينفع تتراجع في القرار ده.')) {
      return;
    }
    
    try {
      await cancelBooking(bookingId);
      showToast('تم إلغاء الحجز بنجاح', 'success');
      // Refresh the lists
      await fetchUpcoming();
    } catch (error: any) {
      console.error('Failed to cancel booking', error);
      showToast(parseApiError(error, 'مش قادرين نلغي الحجز. ممكن يكون الوقت اتأخر على الإلغاء.'), 'error');
    }
  };

  return (
    <div className="my-bookings-container">
      <div className="bookings-header">
        <h1>مواعيدي</h1>
        <p>تابع حجوزاتك الجاية وشوف السجل بتاعك.</p>
      </div>

      <div className="bookings-tabs">
        <button 
          className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => { setActiveTab('upcoming'); setPage(1); }}
        >
          الجاية
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => { setActiveTab('history'); setPage(1); }}
        >
          السجل
        </button>
      </div>

      <div className="bookings-content">
        {isLoading ? (
          <div className="loading-state">
            <div className="mrx-spinner"></div>
          </div>
        ) : activeTab === 'upcoming' ? (
          upcoming.length === 0 ? (
            <div className="empty-state">
              <h3>مفيش حجوزات جاية</h3>
              <p>معندكش أي مواعيد محجوزة دلوقتي.</p>
            </div>
          ) : (
            <div className="bookings-list">
              {upcoming.map(booking => (
                <div key={booking.id} className="booking-card">
                  <div className="booking-card-header">
                    <span className="booking-date">{new Date(booking.bookingDate).toLocaleDateString('ar-EG', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                    <span className={`status-badge status-${booking.status.toLowerCase()}`}>{booking.status}</span>
                  </div>
                  <div className="booking-card-body">
                    <div className="booking-barber">
                      <h3>{booking.barberName}</h3>
                      <p>{formatTime12Hour(booking.startTime)} - {formatTime12Hour(booking.endTime)}</p>
                    </div>
                    <div className="booking-price">
                      <span>الإجمالي</span>
                      <strong>${booking.totalPrice.toFixed(2)}</strong>
                    </div>
                  </div>
                  <div className="booking-services">
                    {booking.services.map(s => s.serviceName).join(' • ')}
                  </div>
                  <div className="booking-card-footer">
                    <button className="btn-cancel-booking" onClick={() => handleCancel(booking.id)}>
                      إلغاء الحجز
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          history.length === 0 ? (
            <div className="empty-state">
              <h3>مفيش سجل حجوزات</h3>
              <p>مواعيدك القديمة هتظهر هنا.</p>
            </div>
          ) : (
            <>
              <div className="bookings-list">
                {history.map(booking => (
                  <div key={booking.id} className="booking-card history-card">
                    <div className="booking-card-header">
                      <span className="booking-date">{new Date(booking.bookingDate).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className={`status-badge status-${booking.status.toLowerCase()}`}>{booking.status}</span>
                    </div>
                    <div className="booking-card-body">
                      <div className="booking-barber">
                        <h3>{booking.barberName}</h3>
                      </div>
                      <div className="booking-price">
                        <strong>${booking.totalPrice.toFixed(2)}</strong>
                      </div>
                    </div>
                    <div className="booking-services">
                      {booking.services.map(s => s.serviceName).join(' • ')}
                    </div>
                  </div>
                ))}
              </div>
              
              {totalPages > 1 && (
                <div className="pagination">
                  <button 
                    disabled={page === 1} 
                    onClick={() => setPage(p => p - 1)}
                  >
                    السابق
                  </button>
                  <span>صفحة {page} من {totalPages}</span>
                  <button 
                    disabled={page === totalPages} 
                    onClick={() => setPage(p => p + 1)}
                  >
                    التالي
                  </button>
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
