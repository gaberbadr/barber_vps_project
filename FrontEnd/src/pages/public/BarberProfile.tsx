import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBarberById, getBarberAvailability, BarberDTO, AvailabilitySlot } from '../../api/barbers.api';
import './BarberProfile.css';
import { useAuth } from '../../context/AuthContext';
import { formatTime12Hour } from '../../utils/timeFormat';

export default function BarberProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  const [barber, setBarber] = useState<BarberDTO | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  
  const [isLoadingBarber, setIsLoadingBarber] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchBarber = async () => {
      setIsLoadingBarber(true);
      try {
        const data = await getBarberById(id);
        setBarber(data);
      } catch (err: any) {
        console.error('Failed to load barber profile', err);
        setError('الحلاق مش موجود أو غير متاح حالياً.');
      } finally {
        setIsLoadingBarber(false);
      }
    };
    fetchBarber();
  }, [id]);

  useEffect(() => {
    if (!id || !selectedDate) return;
    const fetchSlots = async () => {
      setIsLoadingSlots(true);
      setSlotsError(null);
      setSelectedSlot(null);
      try {
        const data = await getBarberAvailability(id, selectedDate);
        setSlots(data);
      } catch (err: any) {
        console.error('Failed to load availability', err);
        setSlotsError('مش قادرين نحمل المواعيد لليوم ده.');
        setSlots([]);
      } finally {
        setIsLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [id, selectedDate]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const handleBookSlot = () => {
    if (!selectedSlot || !barber) return;
    
    const pendingBooking = {
      barberId: barber.id,
      bookingDate: selectedDate,
      startTime: selectedSlot.startTime,
      serviceIds: [] // To be selected in the next step
    };
    
    sessionStorage.setItem('pendingBooking', JSON.stringify(pendingBooking));
    
    if (isAuthenticated) {
      navigate(`/barbers/${barber.id}/book`);
    } else {
      navigate('/login', { state: { returnTo: `/barbers/${barber.id}/book` } });
    }
  };

  if (isLoadingBarber) {
    return (
      <div className="barber-profile-container loading">
        <div className="skeleton-header"></div>
        <div className="skeleton-body"></div>
      </div>
    );
  }

  if (error || !barber) {
    return (
      <div className="barber-profile-container error">
        <h2>{error}</h2>
        <button className="btn-secondary" onClick={() => navigate('/barbers')}>الرجوع للحلاقين</button>
      </div>
    );
  }

  return (
    <div className="barber-profile-immersive">
      {/* Immersive Background */}
      <div className="immersive-bg-container">
        <img 
          src="/luxury-barbershop-bg.png" 
          alt="Atmosphere" 
          className="immersive-bg-img"
        />
        <div className="immersive-gradient-overlay"></div>
      </div>

      <div className="immersive-layout-grid">
        {/* Left Side: Barber Info */}
        <div className="immersive-info-side">
          <div className="barber-portrait-wrapper">
             {barber.profilePictureUrl ? (
                <img src={barber.profilePictureUrl} alt={barber.fullName} className="barber-portrait" />
             ) : (
                <div className="barber-portrait-placeholder">{barber.fullName.charAt(0)}</div>
             )}
          </div>
          
          <span className="immersive-eyebrow">الحلاق</span>
          <h1 className="immersive-name">{barber.fullName.toUpperCase()}</h1>
          
          <div className="immersive-status-block">
            <div className={`status-indicator ${barber.acceptingBookings ? 'active' : 'inactive'}`}></div>
            <span className="status-text">
              {barber.acceptingBookings ? 'متاح للحجز' : 'مفيش مواعيد'}
            </span>
          </div>
          
          <p className="immersive-duration">مدة الجلسة: {barber.bookingDurationMinutes} دقيقة</p>
          
          <div className="immersive-quote">
            "الحلاقة مش مجرد شغل، دي فن ومزاج."
          </div>
        </div>

        {/* Right Side: Glass Booking Card */}
        <div className="immersive-booking-side">
          <div className="glass-booking-card">
            <h2 className="glass-title">احجز كرسيك</h2>
            <p className="glass-subtitle">اختار اليوم والوقت اللي يريحك.</p>

            <div className="glass-date-picker">
              <input 
                type="date" 
                id="date"
                value={selectedDate} 
                onChange={handleDateChange}
                min={new Date().toISOString().split('T')[0]}
                disabled={!barber.acceptingBookings}
              />
            </div>

            <div className="glass-slots-container">
              {!barber.acceptingBookings ? (
                <div className="glass-message warning">
                  غير متاح لحجوزات جديدة دلوقتي.
                </div>
              ) : isLoadingSlots ? (
                <div className="glass-slots-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="glass-slot skeleton"></div>
                  ))}
                </div>
              ) : slotsError ? (
                <div className="glass-message error">{slotsError}</div>
              ) : slots.length > 0 ? (
                <div className="glass-slots-grid">
                  {slots.map((slot, index) => {
                    const isSelected = selectedSlot?.startTime === slot.startTime;
                    return (
                      <button
                        key={index}
                        className={`glass-slot ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {formatTime12Hour(slot.startTime)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="glass-message">
                  مفيش مواعيد فاضية في اليوم ده.
                </div>
              )}
            </div>

            {selectedSlot && barber.acceptingBookings && (
              <div className="glass-action-area">
                <div className="glass-summary">
                  <span>{new Date(selectedDate).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}</span>
                  <span className="dot-separator">•</span>
                  <span className="highlight-time">{formatTime12Hour(selectedSlot.startTime)}</span>
                </div>
                <button className="btn-glass-confirm" onClick={handleBookSlot}>
                  &larr; تأكيد الحجز
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
