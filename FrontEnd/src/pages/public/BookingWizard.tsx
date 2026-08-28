import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getBarberById, getBarberAvailability, BarberDTO, AvailabilitySlot } from '../../api/barbers.api';
import { createBooking } from '../../api/bookings.api';
import { getPublicServices, ServiceDTO } from '../../api/services.api';
import { useToast } from '../../context/ToastContext';
import { parseApiError } from '../../utils/errorParser';
import { formatTime12Hour } from '../../utils/timeFormat';
import './BookingWizard.css';

type Step = 1 | 2 | 3 | 4;

export default function BookingWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Data
  const [barber, setBarber] = useState<BarberDTO | null>(null);
  const [services, setServices] = useState<ServiceDTO[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  
  // Form State
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [showCouponInput, setShowCouponInput] = useState(false);
  // Fetch initial data
  useEffect(() => {
    if (!id) return;

    const fetchInitialData = async () => {
      try {
        const [barberData, servicesData] = await Promise.all([
          getBarberById(id),
          getPublicServices()
        ]);
        setBarber(barberData);
        setServices(servicesData);

        // Restore pending booking if exists
        const pendingBookingRaw = sessionStorage.getItem('pendingBooking');
        if (pendingBookingRaw) {
          const pendingBooking = JSON.parse(pendingBookingRaw);
          if (pendingBooking.barberId === id) {
            setSelectedDate(pendingBooking.bookingDate || '');
            setSelectedSlot(pendingBooking.startTime || '');
            setSelectedServiceIds(pendingBooking.serviceIds || []);
            setCouponCode(pendingBooking.couponCode || '');
            setFullName(pendingBooking.fullName || '');
            setPhoneNumber(pendingBooking.phoneNumber || '');
            
            if (pendingBooking.serviceIds && pendingBooking.serviceIds.length > 0 && pendingBooking.fullName) {
              setStep(4); // Skip to confirmation if they were redirected from step 4
            } else {
              setStep(1); // Start at services if they came from BarberProfile
            }
          }
          sessionStorage.removeItem('pendingBooking');
        }
      } catch (error) {
        console.error('Error fetching data for booking wizard', error);
        showToast('مش قادرين نحمل بيانات الحلاق أو الخدمات', 'error');
        navigate('/barbers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [id, navigate, showToast]);

  // Fetch availability when date changes
  useEffect(() => {
    if (!id || !selectedDate) return;
    
    const fetchAvailability = async () => {
      try {
        const slots = await getBarberAvailability(id, selectedDate);
        
        // Filter out past slots if selectedDate is today
        const today = new Date();
        const localDateString = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        
        if (selectedDate === localDateString) {
          const currentHour = today.getHours();
          const currentMinute = today.getMinutes();
          
          const validSlots = slots.filter(slot => {
            const [hours, minutes] = slot.startTime.split(':').map(Number);
            if (hours > currentHour) return true;
            if (hours === currentHour && minutes > currentMinute) return true;
            return false;
          });
          setAvailability(validSlots);
        } else {
          setAvailability(slots);
        }
        
        setSelectedSlot(''); // Reset slot on date change
      } catch (error) {
        console.error('Failed to fetch availability', error);
        setAvailability([]);
      }
    };
    fetchAvailability();
  }, [id, selectedDate]);

  // Derived state
  const selectedServices = services.filter(s => selectedServiceIds.includes(s.id));
  const subTotal = selectedServices.reduce((sum, s) => sum + s.price, 0);

  const handleNext = () => {
    if (step === 1 && selectedServiceIds.length === 0) {
      showToast('يا ريت تختار خدمة واحدة على الأقل', 'error');
      return;
    }
    if (step === 2 && (!selectedDate || !selectedSlot)) {
      showToast('يا ريت تختار اليوم والوقت المتاح', 'error');
      return;
    }
    if (step === 3 && (!fullName || !phoneNumber)) {
      showToast('يا ريت تكتب اسمك ورقم تليفونك', 'error');
      return;
    }
    setStep((prev) => (prev + 1) as Step);
  };

  const handleBack = () => {
    setStep((prev) => (prev - 1) as Step);
  };

  const toggleService = (serviceId: number) => {
    setSelectedServiceIds(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleConfirm = async () => {
    if (!id) return;
    
    const bookingPayload: any = {
      barberId: String(id),
      bookingDate: selectedDate,
      startTime: selectedSlot.split(':').length === 2 ? `${selectedSlot}:00`.padStart(8, '0') : selectedSlot.padStart(8, '0'),
      serviceIds: selectedServiceIds,
      couponCode: couponCode ? couponCode.trim() : undefined,
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.replace(/^\+20|\s/g, ''),
      customerName: fullName.trim(),
      customerPhone: phoneNumber.replace(/^\+20|\s/g, '')
    };

    if (!isAuthenticated) {
      sessionStorage.setItem('pendingBooking', JSON.stringify(bookingPayload));
      navigate('/login', { state: { returnTo: location.pathname } });
      return;
    }

    setIsSubmitting(true);
    try {
      await createBooking(bookingPayload);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Booking failed', error);
      if (error.response?.status === 409) {
        showToast(parseApiError(error, 'الوقت ده أو الكوبون مش متاح. جرب تاني.'), 'error');
        // If conflict, force refresh of slots
        const slots = await getBarberAvailability(id, selectedDate).catch(() => []);
        setAvailability(slots);
        setSelectedSlot('');
        setStep(2); // Go back to step 2
      } else {
        const errMsg = parseApiError(error, 'فشل تأكيد الحجز.');
        showToast(errMsg, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="wizard-loading">
        <div className="mrx-spinner mrx-spinner-large"></div>
      </div>
    );
  }

  if (!barber) return null;

  return (
    <div className="wizard-container">
      <div className="wizard-header">
        <h1>حجز موعد</h1>
        <p>مع {barber.fullName}</p>
        
        <div className="wizard-progress">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`progress-step ${step >= s ? 'active' : ''}`}></div>
          ))}
        </div>
      </div>

      <div className="wizard-body">
        {step === 1 && (
          <div className="wizard-step step-services">
            <h2>اختار الخدمات</h2>
            <div className="services-grid">
              {services.length === 0 ? (
                <p>مفيش خدمات متاحة حالياً.</p>
              ) : (
                services.map(service => {
                  const isSelected = selectedServiceIds.includes(service.id);
                  return (
                    <div 
                      key={service.id} 
                      className={`service-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleService(service.id)}
                    >
                      <div className="service-info">
                        <h3>{service.name}</h3>
                        {service.description && <p>{service.description}</p>}
                      </div>
                      <div className="service-price">
                        ${service.price.toFixed(2)}
                      </div>
                      <div className="service-checkbox">
                        {isSelected && <span className="check-mark">✓</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {selectedServiceIds.length > 0 && (
              <div className="step-summary">
                <span>تم اختيار {selectedServiceIds.length} خدمة</span>
                <span>الإجمالي: ${subTotal.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="wizard-step step-datetime">
            <h2>اختار اليوم والوقت</h2>
            <div className="form-group">
              <label>اليوم</label>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} // today
              />
            </div>

            {selectedDate && (
              <div className="slots-container">
                <label>المواعيد المتاحة</label>
                {availability.length === 0 ? (
                  <p className="no-slots">مفيش مواعيد متاحة في اليوم ده.</p>
                ) : (
                  <div className="slots-grid">
                    {availability.map((slot, idx) => {
                      const isSelected = selectedSlot === slot.startTime;
                      return (
                        <button
                          key={idx}
                          className={`slot-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedSlot(slot.startTime)}
                        >
                          {formatTime12Hour(slot.startTime)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="wizard-step step-details">
            <h2>بياناتك</h2>
            <div className="form-group">
              <label>الاسم بالكامل</label>
              <input 
                type="text" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="أحمد محمد"
              />
            </div>
            <div className="form-group">
              <label>رقم التليفون</label>
              <input 
                type="tel" 
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="01001234567"
              />
            </div>
            {showCouponInput ? (
              <div className="form-group">
                <label>كوبون خصم (اختياري)</label>
                <input 
                  type="text" 
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="خصم10"
                />
              </div>
            ) : (
              <div className="coupon-toggle-container">
                <button 
                  type="button" 
                  className="btn-text-link" 
                  onClick={() => setShowCouponInput(true)}
                >
                  لو معاك كود خصم اضغط هنا
                </button>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="wizard-step step-confirmation">
            <h2>ملخص الحجز</h2>
            
            <div className="summary-card">
              <div className="summary-section">
                <h3>الميعاد</h3>
                <p><strong>الحلاق:</strong> {barber.fullName}</p>
                <p><strong>اليوم:</strong> {selectedDate}</p>
                <p><strong>الوقت:</strong> {formatTime12Hour(selectedSlot)}</p>
              </div>
              
              <div className="summary-section">
                <h3>الخدمات</h3>
                <ul className="summary-services">
                  {selectedServices.map(s => (
                    <li key={s.id}>
                      <span>{s.name}</span>
                      <span>${s.price.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="summary-section">
                <h3>البيانات</h3>
                <p><strong>الاسم:</strong> {fullName}</p>
                <p><strong>التليفون:</strong> {phoneNumber}</p>
                {couponCode && <p><strong>كوبون:</strong> {couponCode}</p>}
              </div>

              <div className="summary-total">
                <span>الإجمالي</span>
                <span>${subTotal.toFixed(2)}</span>
              </div>
              
              {!isAuthenticated && (
                <div className="auth-warning">
                  <p>هيتم تحويلك لتسجيل الدخول عشان تأكد الحجز.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="wizard-footer">
        {step > 1 ? (
          <button className="btn-secondary" onClick={handleBack} disabled={isSubmitting}>
            رجوع
          </button>
        ) : (
          <div></div> // Empty div for flex space-between
        )}
        
        {step < 4 ? (
          <button className="btn-primary" onClick={handleNext}>
            متابعة
          </button>
        ) : (
          <button className="btn-primary btn-confirm" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'جاري التأكيد...' : (isAuthenticated ? 'تأكيد الحجز' : 'سجل دخول لتأكيد الحجز')}
          </button>
        )}
      </div>

      {showSuccessModal && (
        <div className="wizard-modal-overlay">
          <div className="wizard-modal-content">
            <div className="wizard-modal-icon">✅</div>
            <h2 className="wizard-modal-title">تم تأكيد الحجز بنجاح!</h2>
            
            <div className="wizard-modal-body">
              <div className="alert-box alert-warning">
                <strong>تنبيه هام جداً:</strong> 
                بلاش تتأخر على ميعادك! لو اتأخرت من 5 لـ 10 دقايق، ممكن حد تاني ياخد مكانك. الأفضل تيجي بدري 5 دقايق عشان تاخد وقتك ومزاجك.
              </div>
              <div className="alert-box alert-info">
                <strong>سياسة الإلغاء:</strong>
                متقدرش تلغي الحجز قبل الميعاد بأقل من {(barber.cancellationPolicyHours || 2) === 1 ? 'ساعة' : (barber.cancellationPolicyHours || 2) === 2 ? 'ساعتين' : `${barber.cancellationPolicyHours || 2} ${(barber.cancellationPolicyHours || 2) <= 10 ? 'ساعات' : 'ساعة'}`}. يا ريت تلتزم بالمواعيد عشان منضطرش نحظر حسابك.
              </div>
            </div>

            <button 
              className="btn-primary btn-full"
              onClick={() => navigate('/bookings')}
            >
              فهمت، وديني لحجوزاتي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
