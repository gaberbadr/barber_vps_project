import React, { useEffect, useState } from 'react';
import { getAdminBarbers, createBarber, deleteBarber, AdminBarberDTO, CreateBarberRequest } from '../../api/admin.api';
import AdminModal from '../../components/admin/AdminModal';
import { useToast } from '../../context/ToastContext';
import { parseApiError } from '../../utils/errorParser';
import './AdminBarbers.css';

export default function AdminBarbers() {
  const { showToast } = useToast();
  const [barbers, setBarbers] = useState<AdminBarberDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<CreateBarberRequest>({
    fullName: '',
    email: '',
    phoneNumber: '',
    bookingDurationMinutes: 30,
    acceptingBookings: true
  });

  const fetchBarbers = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const rawData = await getAdminBarbers() as any;
      const barbersArray = Array.isArray(rawData) ? rawData 
                         : (rawData?.data && Array.isArray(rawData.data)) ? rawData.data
                         : (rawData?.$values && Array.isArray(rawData.$values)) ? rawData.$values
                         : (rawData?.items && Array.isArray(rawData.items)) ? rawData.items
                         : (rawData?.Items && Array.isArray(rawData.Items)) ? rawData.Items
                         : [];
      setBarbers(barbersArray);
    } catch (error) {
      console.error('Failed to fetch barbers:', error);
      setBarbers([]);
      setFetchError('السيرفر مش شغال دلوقتي. جرب تاني بعد شوية.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBarbers();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createBarber(formData);
      showToast('تم إضافة الحلاق بنجاح', 'success');
      setIsModalOpen(false);
      setFormData({
        fullName: '',
        email: '',
        phoneNumber: '',
        bookingDurationMinutes: 30,
        acceptingBookings: true
      });
      fetchBarbers();
    } catch (error: any) {
      showToast(parseApiError(error, 'فشل إضافة الحلاق. جرب تاني.'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`متأكد إنك عايز تمسح/تعطل حساب ${name}؟`)) {
      try {
        await deleteBarber(id);
        showToast('تم مسح الحلاق بنجاح', 'success');
        fetchBarbers();
      } catch (error: any) {
        showToast(parseApiError(error, 'فشل مسح الحلاق.'), 'error');
      }
    }
  };

  return (
    <div className="admin-barbers">
      <header className="admin-page-header">
        <h1>إدارة الحلاقين</h1>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>إضافة حلاق</button>
      </header>

      <div className="admin-barbers-grid">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton-card"></div>)
        ) : fetchError ? (
          <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: '#EF5350', background: 'rgba(239, 83, 80, 0.05)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <span style={{ fontWeight: '500' }}>{fetchError}</span>
          </div>
        ) : barbers.length > 0 ? (
          barbers.map(barber => (
            <div className="barber-card" key={barber.id}>
              <div className="barber-card-header">
                <div className="barber-card-title">
                  <h3>{barber.fullName}</h3>
                  <p>{barber.email}</p>
                </div>
                <span className={`status-badge ${barber.acceptingBookings ? 'active' : 'expired'}`}>
                  {barber.acceptingBookings ? 'نشط' : 'مش بيستقبل'}
                </span>
              </div>
              
              <div className="barber-card-body">
                <div className="barber-stat">
                  <span className="barber-stat-label">التليفون</span>
                  <span className="barber-stat-value">{barber.phoneNumber || '-'}</span>
                </div>
                <div className="barber-stat">
                  <span className="barber-stat-label">مدة الحجز</span>
                  <span className="barber-stat-value">{barber.bookingDurationMinutes} دقايق</span>
                </div>
                <div className="barber-stat">
                  <span className="barber-stat-label">تاريخ الانضمام</span>
                  <span className="barber-stat-value">{new Date(barber.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="barber-card-footer">
                <button 
                  className="btn-action btn-delete" 
                  onClick={() => handleDelete(barber.id, barber.fullName)}
                >
                  مسح
                </button>
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: '#8C867E', gridColumn: '1 / -1', padding: '3rem', textAlign: 'center' }}>
            مفيش حلاقين.
          </div>
        )}
      </div>

      <AdminModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="إضافة حلاق جديد">
        <form onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label>الاسم بالكامل</label>
            <input 
              type="text" 
              name="fullName" 
              required 
              value={formData.fullName} 
              onChange={handleInputChange} 
            />
          </div>

          <div className="admin-form-group">
            <label>الإيميل</label>
            <input 
              type="email" 
              name="email" 
              required 
              value={formData.email} 
              onChange={handleInputChange} 
            />
          </div>

          <div className="admin-form-group">
            <label>التليفون (اختياري)</label>
            <input 
              type="tel" 
              name="phoneNumber" 
              value={formData.phoneNumber} 
              onChange={handleInputChange} 
            />
          </div>

          <div className="admin-form-group">
            <label>مدة الحجز (بالدقايق)</label>
            <input 
              type="number" 
              name="bookingDurationMinutes" 
              required
              min="5" step="5"
              value={formData.bookingDurationMinutes} 
              onChange={handleInputChange} 
            />
          </div>

          <div className="admin-form-group" style={{ flexDirection: 'row', alignItems: 'center', marginTop: '1rem' }}>
            <input 
              type="checkbox" 
              id="acceptingBookings"
              name="acceptingBookings" 
              checked={formData.acceptingBookings} 
              onChange={handleInputChange} 
            />
            <label htmlFor="acceptingBookings" className="admin-checkbox-label">
              استقبال حجوزات
            </label>
          </div>

          <div className="admin-modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>إلغاء</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'جاري الحفظ...' : 'إضافة الحلاق'}
            </button>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
