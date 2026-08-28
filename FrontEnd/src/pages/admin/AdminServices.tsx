import React, { useEffect, useState } from 'react';
import { getAdminServices, createAdminService, updateAdminService, deleteAdminService, AdminServiceDTO } from '../../api/admin.api';
import AdminModal from '../../components/admin/AdminModal';
import { useToast } from '../../context/ToastContext';
import { parseApiError } from '../../utils/errorParser';
import './AdminServices.css';
import axios from 'axios';

export default function AdminServices() {
  const [services, setServices] = useState<AdminServiceDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<AdminServiceDTO | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | string>('');
  const [isActive, setIsActive] = useState(true);

  const { showToast } = useToast();

  const fetchServices = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const rawData = await getAdminServices() as any;
      const extractArray = (obj: any): any[] => {
        if (!obj) return [];
        if (Array.isArray(obj)) return obj;
        if (obj.$values && Array.isArray(obj.$values)) return obj.$values;
        if (obj.items) return extractArray(obj.items);
        if (obj.Items) return extractArray(obj.Items);
        if (obj.data) return extractArray(obj.data);
        if (obj.Data) return extractArray(obj.Data);
        if (obj.result) return extractArray(obj.result);
        if (obj.Result) return extractArray(obj.Result);
        return [];
      };
      
      const mappedServices = extractArray(rawData).map((s: any) => ({
        id: s.id ?? s.Id,
        name: s.name ?? s.Name,
        description: s.description ?? s.Description ?? '',
        price: s.price ?? s.Price ?? 0,
        isActive: s.isActive ?? s.IsActive ?? true,
      }));
      
      setServices(mappedServices);
    } catch (error: any) {
      console.error('Failed to fetch services:', error);
      setServices([]);
      setFetchError(parseApiError(error, 'السيرفر مش شغال دلوقتي. جرب تاني بعد شوية.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleOpenModal = (service?: AdminServiceDTO) => {
    if (service) {
      setEditingService(service);
      setName(service.name);
      setDescription(service.description || '');
      setPrice(service.price);
      setIsActive(service.isActive);
    } else {
      setEditingService(null);
      setName('');
      setDescription('');
      setPrice('');
      setIsActive(true);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      showToast('اسم الخدمة مطلوب', 'error');
      return;
    }

    if (name.length > 100) {
      showToast('اسم الخدمة ميزيدش عن 100 حرف', 'error');
      return;
    }

    if (description.length > 500) {
      showToast('الوصف ميزيدش عن 500 حرف', 'error');
      return;
    }
    
    const parsedPrice = parseFloat(price.toString());
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      showToast('السعر لازم يكون رقم موجب', 'error');
      return;
    }

    const payload: any = {
      name: name.trim(),
      description: description.trim() || undefined,
      price: parsedPrice,
      isActive
    };

    if (editingService) {
      payload.id = editingService.id;
    }

    try {
      if (editingService) {
        await updateAdminService(editingService.id, payload);
        showToast('تم تحديث الخدمة بنجاح', 'success');
      } else {
        await createAdminService(payload);
        showToast('تم إنشاء الخدمة بنجاح', 'success');
      }
      handleCloseModal();
      fetchServices();
      } catch (error: any) {
        console.error('Failed to save service:', error);
        showToast(parseApiError(error, 'فشل حفظ الخدمة'), 'error');
      }
  };

  const handleDelete = async (service: AdminServiceDTO) => {
    if (window.confirm(`متأكد إنك عايز تمسح ${service.name}؟`)) {
      try {
        await deleteAdminService(service.id);
        showToast('تم مسح الخدمة بنجاح', 'success');
        fetchServices();
      } catch (error: any) {
        console.error('Failed to delete service:', error);
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          showToast(parseApiError(error, 'مينفعش نمسح الخدمة دي عشان مربوطة بحجوزات موجودة.'), 'error');
        } else {
          showToast(parseApiError(error, 'فشل مسح الخدمة. ممكن تكون مربوطة بحجوزات. الأفضل تعدلها وتخليها غير نشطة.'), 'error');
        }
      }
    }
  };

  return (
    <div className="admin-services">
      <header className="admin-page-header">
        <h1>إدارة الخدمات</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => handleOpenModal()}>
            إضافة خدمة جديدة
          </button>
        </div>
      </header>

      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>الرقم</th>
              <th>اسم الخدمة</th>
              <th>الوصف</th>
              <th>السعر</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="skeleton-row">
                  <td><div className="skeleton-cell" style={{ width: '40px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '120px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '200px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '80px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '60px' }}></div></td>
                  <td><div className="skeleton-cell" style={{ width: '100px' }}></div></td>
                </tr>
              ))
            ) : fetchError ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#EF5350', background: 'rgba(239, 83, 80, 0.05)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                    <span style={{ fontWeight: '500' }}>{fetchError}</span>
                  </div>
                </td>
              </tr>
            ) : services.length > 0 ? (
              services.map((service) => (
                <tr key={service.id}>
                  <td>#{service.id}</td>
                  <td>{service.name}</td>
                  <td>{service.description || '-'}</td>
                  <td>ج.م {service.price.toFixed(2)}</td>
                  <td>
                    <span className={`status-badge ${service.isActive ? 'active' : 'inactive'}`}>
                      {service.isActive ? 'نشط' : 'غير نشط'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn-action btn-edit"
                      onClick={() => handleOpenModal(service)}
                    >
                      تعديل
                    </button>
                    <button 
                      className="btn-action btn-delete"
                      onClick={() => handleDelete(service)}
                    >
                      مسح
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#8C867E' }}>
                  مفيش خدمات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingService ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}
      >
        <form className="service-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">اسم الخدمة *</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: حلاقة شعر"
              maxLength={100}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">الوصف (اختياري)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثلاً: حلاقة شعر احترافية"
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="price">السعر (ج.م) *</label>
            <input
              type="number"
              id="price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              required
            />
          </div>

          <div className="form-group checkbox-group">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="isActive">نشط</label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={handleCloseModal}>
              إلغاء
            </button>
            <button type="submit" className="btn-primary">
              {editingService ? 'حفظ التغييرات' : 'إنشاء الخدمة'}
            </button>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
