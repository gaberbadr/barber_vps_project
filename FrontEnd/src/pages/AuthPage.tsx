import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { sendVerificationCode, verifyCode, getGoogleLoginUrl } from '../api/auth.api';
import { parseApiError } from '../utils/errorParser';
import '../components/auth/MrxAuth.css';

// ─── Icons ──────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const OTP_LENGTH = 6;
const OTP_COOLDOWN = 180; // 3 minutes

export default function AuthPage() {
  const { handleLoginSuccess } = useAuth();
  
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer logic
  useEffect(() => {
    if (timer > 0) {
      timerRef.current = window.setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timer]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `0${m}:${String(s).padStart(2, '0')}`;
  };

  const handleGoogleLogin = () => {
    // Current frontend host acts as the redirect URI base
    const redirectUrl = `${window.location.origin}/callback`;
    window.location.href = getGoogleLoginUrl(redirectUrl);
  };

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!isValidEmail(email)) {
      setErrorMsg('يا ريت تكتب إيميل صح.');
      return;
    }
    
    setLoading(true);
    try {
      await sendVerificationCode(email.trim());
      setOtpSent(true);
      setTimer(OTP_COOLDOWN);
    } catch (err: any) {
      setErrorMsg(parseApiError(err, 'مش قادرين نبعت كود التأكيد.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (otpValue.length !== OTP_LENGTH) {
      setErrorMsg(`يا ريت تكتب كود من ${OTP_LENGTH} أرقام.`);
      return;
    }

    setLoading(true);
    try {
      const tokens = await verifyCode(email.trim(), otpValue);
      handleLoginSuccess(tokens);
    } catch (err: any) {
      setErrorMsg(parseApiError(err, 'الكود غلط أو مدته خلصت.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    setErrorMsg('');
    setLoading(true);
    try {
      await sendVerificationCode(email.trim());
      setTimer(OTP_COOLDOWN);
      setOtpValue('');
    } catch (err: any) {
      setErrorMsg(parseApiError(err, 'مش قادرين نبعت الكود تاني.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mrx-auth-page">
      <div className="mrx-auth-card">
        <div className="mrx-auth-header">
          <h1 className="mrx-auth-title">أهلاً بيك</h1>
          <p className="mrx-auth-subtitle">اكتب إيميلك عشان تدخل عالم الحلاقة على أصولها.</p>
        </div>

        <button type="button" className="mrx-btn mrx-btn-google" onClick={handleGoogleLogin}>
          <GoogleIcon /> كمل بـ Google
        </button>

        <div className="mrx-divider">أو</div>

        {!otpSent ? (
          <form onSubmit={handleSendCode} className="mrx-form-group">
            <label className="mrx-label" htmlFor="email-input">البريد الإلكتروني (الإيميل)</label>
            <input
              id="email-input"
              type="email"
              className={`mrx-input ${errorMsg ? 'mrx-input--error' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
              disabled={loading}
              autoFocus
            />
            {errorMsg && (
              <div className="mrx-error-alert" style={{ marginTop: '0.5rem' }}>
                <AlertIcon /> <span style={{ fontSize: '0.85rem' }}>{errorMsg}</span>
              </div>
            )}
            
            <button 
              type="submit" 
              className="mrx-btn mrx-btn-primary" 
              style={{ marginTop: '1rem' }}
              disabled={loading || !email.trim()}
            >
              {loading ? (
                <><div className="mrx-spinner" /> جاري الإرسال...</>
              ) : (
                'ابعت كود التأكيد'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="mrx-form-group">
            <label className="mrx-label" htmlFor="otp-input">كود التأكيد</label>
            <p className="mrx-auth-subtitle" style={{ marginBottom: '0.5rem' }}>
              بعتنا كود على <strong>{email}</strong>
            </p>
            <input
              id="otp-input"
              type="text"
              inputMode="numeric"
              maxLength={OTP_LENGTH}
              className={`mrx-input ${errorMsg ? 'mrx-input--error' : ''}`}
              placeholder="000000"
              style={{ letterSpacing: '0.5rem', textAlign: 'center', fontSize: '1.25rem' }}
              value={otpValue}
              onChange={(e) => { 
                setOtpValue(e.target.value.replace(/\D/g, '')); 
                setErrorMsg(''); 
              }}
              disabled={loading}
              autoFocus
            />
            {errorMsg && (
              <div className="mrx-error-alert" style={{ marginTop: '0.5rem' }}>
                <AlertIcon /> <span style={{ fontSize: '0.85rem' }}>{errorMsg}</span>
              </div>
            )}
            
            <button 
              type="submit" 
              className="mrx-btn mrx-btn-primary" 
              style={{ marginTop: '1rem' }}
              disabled={loading || otpValue.length < OTP_LENGTH}
            >
              {loading ? (
                <><div className="mrx-spinner" /> جاري التأكد...</>
              ) : (
                'تأكيد وتسجيل الدخول'
              )}
            </button>

            <div className="mrx-otp-meta">
              <button 
                type="button" 
                className="mrx-btn-text" 
                onClick={() => { setOtpSent(false); setTimer(0); setOtpValue(''); setErrorMsg(''); }}
                disabled={loading}
              >
                تغيير الإيميل
              </button>
              
              {timer > 0 ? (
                <span>ابعت تاني بعد {formatTimer(timer)}</span>
              ) : (
                <button 
                  type="button" 
                  className="mrx-btn-text" 
                  onClick={handleResend}
                  disabled={loading}
                >
                  ابعت الكود تاني
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
