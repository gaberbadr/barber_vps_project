import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../components/auth/MrxAuth.css';

const AlertIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#A98B62' }}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleLoginSuccess } = useAuth();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setStatus('error');
      if (error.includes('Invalid column name') || error.includes('500')) {
        setErrorMsg('حصل مشكلة في السيرفر. جرب تاني بعد شوية أو كلم الدعم.');
      } else {
        setErrorMsg(error);
      }
      return;
    }

    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const accessTokenExpiresAt = searchParams.get('accessTokenExpiresAt');
    const refreshTokenExpiresAt = searchParams.get('refreshTokenExpiresAt');

    if (accessToken && refreshToken && accessTokenExpiresAt && refreshTokenExpiresAt) {
      setStatus('success');
      
      // Artificial delay for smooth UI transition (luxurious feel)
      const timer = setTimeout(() => {
        handleLoginSuccess({
          accessToken,
          refreshToken,
          accessTokenExpiresAt,
          refreshTokenExpiresAt
        });
      }, 1500);

      return () => clearTimeout(timer);
    } else {
      setStatus('error');
      setErrorMsg('بيانات الدخول اللي وصلت مش مظبوطة.');
    }
  }, [searchParams, handleLoginSuccess]);

  return (
    <div className="mrx-auth-page">
      <div className="mrx-callback-card">
        {status === 'loading' && (
          <>
            <div className="mrx-spinner mrx-spinner-large" />
            <h2 className="mrx-auth-title" style={{ fontSize: '1.5rem', marginTop: '1rem' }}>جاري تسجيل الدخول...</h2>
            <p className="mrx-auth-subtitle">استنى ثواني، بندخلك على حسابك بأمان.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckIcon />
            <h2 className="mrx-auth-title" style={{ fontSize: '1.5rem', marginTop: '1rem' }}>تم بنجاح</h2>
            <p className="mrx-auth-subtitle">هنحولك دلوقتي للصفحة المطلوبة...</p>
          </>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div className="mrx-error-alert" style={{ width: '100%', maxWidth: '350px' }}>
              <AlertIcon />
              <div>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: 'var(--mrx-error)', textAlign: 'left' }}>فشل تسجيل الدخول</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--mrx-text-primary)', opacity: 0.9, textAlign: 'left' }}>{errorMsg}</p>
              </div>
            </div>
            <button 
              className="mrx-btn mrx-btn-primary" 
              style={{ marginTop: '2rem', maxWidth: '350px' }}
              onClick={() => navigate('/login', { replace: true })}
            >
              الرجوع لتسجيل الدخول
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
