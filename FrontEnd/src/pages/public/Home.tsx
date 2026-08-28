import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBarbers, BarberDTO } from '../../api/barbers.api';
import { getPublicServices, ServiceDTO } from '../../api/services.api';
import './Home.css';

const MOCK_BARBERS: BarberDTO[] = [
  {
    id: 'mock-1',
    fullName: 'Alexander Cole',
    email: '',
    profilePictureUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=80&w=800',
    isActive: true,
  } as BarberDTO,
  {
    id: 'mock-2',
    fullName: 'Marcus Reid',
    email: '',
    profilePictureUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=800',
    isActive: true,
  } as BarberDTO,
  {
    id: 'mock-3',
    fullName: 'James Holloway',
    email: '',
    profilePictureUrl: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&q=80&w=800',
    isActive: true,
  } as BarberDTO,
];

export default function Home() {
  const navigate = useNavigate();
  const [barbers, setBarbers] = useState<BarberDTO[]>([]);
  const [services, setServices] = useState<ServiceDTO[]>([]);
  const [isLoadingBarbers, setIsLoadingBarbers] = useState(true);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [activeCard, setActiveCard] = useState(0);
  
  // Marquee state
  const marqueeRef = useState<HTMLDivElement | null>(null);
  const realMarqueeRef = (el: HTMLDivElement | null) => {
    marqueeRef[1](el);
  };
  const [isMarqueePaused, setIsMarqueePaused] = useState(false);
  const resumeTimeoutRef = useState<ReturnType<typeof setInterval> | null>(null);

  const stageRef = (el: HTMLDivElement | null) => {
    if (!el) return;
    const handler = () => {
      const cardW = el.scrollWidth / Math.max(barbers.length, 1);
      setActiveCard(Math.round(el.scrollLeft / cardW));
    };
    el.addEventListener('scroll', handler, { passive: true });
  };

  useEffect(() => {
    const fetchBarbers = async () => {
      try {
        const data = await getBarbers();
        const active = data.filter(b => b.isActive).slice(0, 4);
        setBarbers(active.length > 0 ? active : MOCK_BARBERS);
      } catch {
        setBarbers(MOCK_BARBERS);
      } finally {
        setIsLoadingBarbers(false);
      }
    };

    const fetchServices = async () => {
      try {
        const data = await getPublicServices();
        setServices(data.filter(s => s.isActive).slice(0, 6));
      } catch {
        // silently fail
      } finally {
        setIsLoadingServices(false);
      }
    };

    fetchBarbers();
    fetchServices();
  }, []);

  // Marquee auto-scroll logic
  useEffect(() => {
    let animationId: number;
    const scroll = () => {
      const el = marqueeRef[0];
      if (!isMarqueePaused && el && services.length > 0) {
        el.scrollLeft += 1;
        // Infinite loop handling
        if (el.scrollLeft >= el.scrollWidth / 2) {
          el.scrollLeft -= el.scrollWidth / 2;
        }
      }
      animationId = requestAnimationFrame(scroll);
    };
    animationId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationId);
  }, [isMarqueePaused, services, marqueeRef[0]]);

  const pauseMarquee = () => {
    setIsMarqueePaused(true);
    if (resumeTimeoutRef[0]) clearTimeout(resumeTimeoutRef[0]);
  };

  const resumeMarquee = () => {
    const timeout = setTimeout(() => {
      setIsMarqueePaused(false);
    }, 1500); // 1.5s wait for momentum to finish
    resumeTimeoutRef[1](timeout);
  };


  return (
    <div className="home-page">

      {/* ====== HERO: FULL-SCREEN CINEMATIC ====== */}
      <section className="mrx-hero-fullscreen" id="barbers">

        {/* — Centered Top Header — */}
        <div className="hero-top">
          <span className="hero-eyebrow">تأسس 2026 &bull; حلاقة على أصولها</span>
          <h1 className="hero-headline">اختار حلاقك</h1>
        </div>

        {/* — Barber Panels — */}
        <div className="hero-cards-stage" ref={stageRef}>
          {isLoadingBarbers ? (
            <div className="hero-loading">
              <span className="loading-spinner"></span>
            </div>
          ) : (
            <div className="hero-cards-row">
              {barbers.map((barber, i) => (
                <div
                  key={barber.id}
                  className="barber-card-seat"
                  style={{ animationDelay: `${i * 0.12}s` }}
                >
                  {/* Card */}
                  <div
                    className="barber-card"
                    onClick={() => navigate(`/barbers/${barber.id}`)}
                  >
                    <img
                      src={
                        barber.profilePictureUrl ||
                        'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&q=80&w=800'
                      }
                      alt={barber.fullName}
                      className="barber-card-img"
                      draggable={false}
                    />

                    {/* Index number */}
                    <div className="barber-card-number">
                      {String(i + 1).padStart(2, '0')}
                    </div>

                    {/* Bottom glass info */}
                    <div className="barber-card-overlay">
                      <div className="barber-card-content">
                        <div className="barber-status">
                          <span className="status-dot"></span>
                          <span>متاح النهاردة</span>
                        </div>
                        <h3 className="barber-name">{barber.fullName}</h3>
                        <p className="barber-role">حلاق محترف</p>
                        <button
                          className="btn-book-card"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/barbers/${barber.id}`);
                          }}
                        >
                          &larr; احجز دلوقتي
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Barber Chair */}
                  <div className="barber-chair-wrap">
                    <svg
                      className="barber-chair-svg"
                      viewBox="0 0 220 160"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      {/* ── Base / Footrest ── */}
                      <ellipse cx="110" cy="152" rx="58" ry="6" fill="rgba(0,0,0,0.35)" />
                      <rect x="82" y="142" width="56" height="8" rx="4" fill="#2A2218" />
                      <rect x="76" y="146" width="68" height="5" rx="2.5" fill="#1A160F" />

                      {/* ── Pedestal pole ── */}
                      <rect x="104" y="112" width="12" height="34" rx="4" fill="#1E1A13" />
                      <rect x="106" y="112" width="4" height="34" rx="2" fill="rgba(201,169,110,0.18)" />

                      {/* ── Hydraulic base ring ── */}
                      <ellipse cx="110" cy="113" rx="22" ry="7" fill="#2C2318" />
                      <ellipse cx="110" cy="111" rx="20" ry="5.5" fill="#352B1C" />
                      <ellipse cx="110" cy="110" rx="18" ry="4" fill="rgba(201,169,110,0.15)" />

                      {/* ── Seat ── */}
                      <path
                        d="M68 95 Q68 108 110 108 Q152 108 152 95 L148 88 Q148 82 110 82 Q72 82 72 88 Z"
                        fill="#2A2218"
                      />
                      <path
                        d="M72 88 Q72 100 110 100 Q148 100 148 88 Q148 83 110 83 Q72 83 72 88 Z"
                        fill="#332919"
                      />
                      {/* seat highlight */}
                      <path
                        d="M85 85 Q85 88 110 88 Q135 88 135 85"
                        stroke="rgba(201,169,110,0.25)" strokeWidth="1.5" fill="none" strokeLinecap="round"
                      />

                      {/* ── Armrests ── */}
                      {/* Left */}
                      <rect x="58" y="72" width="16" height="22" rx="5" fill="#2A2218" />
                      <rect x="56" y="90" width="20" height="5" rx="2.5" fill="#332919" />
                      <rect x="58" y="91" width="16" height="2" rx="1" fill="rgba(201,169,110,0.2)" />
                      {/* Right */}
                      <rect x="146" y="72" width="16" height="22" rx="5" fill="#2A2218" />
                      <rect x="144" y="90" width="20" height="5" rx="2.5" fill="#332919" />
                      <rect x="146" y="91" width="16" height="2" rx="1" fill="rgba(201,169,110,0.2)" />

                      {/* ── Backrest ── */}
                      <path
                        d="M78 82 L78 30 Q78 18 110 18 Q142 18 142 30 L142 82 Q142 76 110 76 Q78 76 78 82 Z"
                        fill="#2A2218"
                      />
                      {/* backrest panels */}
                      <path
                        d="M84 76 L84 32 Q84 24 110 24 Q136 24 136 32 L136 76 Q136 71 110 71 Q84 71 84 76 Z"
                        fill="#332919"
                      />
                      {/* vertical stitching lines */}
                      <line x1="110" y1="24" x2="110" y2="72" stroke="rgba(201,169,110,0.12)" strokeWidth="1" strokeDasharray="4 5" />
                      <line x1="97"  y1="25" x2="97"  y2="72" stroke="rgba(201,169,110,0.08)" strokeWidth="1" strokeDasharray="3 6" />
                      <line x1="123" y1="25" x2="123" y2="72" stroke="rgba(201,169,110,0.08)" strokeWidth="1" strokeDasharray="3 6" />
                      {/* headrest */}
                      <rect x="88" y="14" width="44" height="20" rx="8" fill="#2A2218" />
                      <rect x="91" y="16" width="38" height="16" rx="6" fill="#3A2F1E" />
                      <rect x="95" y="19" width="30" height="4" rx="2" fill="rgba(201,169,110,0.2)" />

                      {/* ── Footrest bar ── */}
                      <rect x="78" y="106" width="64" height="6" rx="3" fill="#1E1A13" />
                      <rect x="80" y="107" width="60" height="3" rx="1.5" fill="rgba(201,169,110,0.15)" />

                      {/* ── Gold trim accent line ── */}
                      <path
                        d="M84 76 Q84 71 110 71 Q136 71 136 76"
                        stroke="rgba(201,169,110,0.4)" strokeWidth="1" fill="none"
                      />
                      <path
                        d="M91 16 Q91 13 110 13 Q129 13 129 16"
                        stroke="rgba(201,169,110,0.3)" strokeWidth="1" fill="none"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scroll dots — mobile only */}
        <div className="hero-scroll-indicator" aria-hidden="true">
          {barbers.map((_, i) => (
            <span key={i} className={`hero-dot${i === activeCard ? ' active' : ''}`} />
          ))}
        </div>

        {/* — Bottom CTA only — */}
        <div className="hero-bottom">
          <button className="btn-browse-all" onClick={() => navigate('/barbers')}>
            شوف كل الحلاقين
          </button>
        </div>

      </section>

      {/* ====== THE RITUALS (Services) ====== */}
      <section className="mrx-rituals" id="services">
        <div className="rituals-content">
          <div className="rituals-header editorial-header">
            <h2 className="section-title">
              <span className="title-muted">خدماتنا</span>
              <span className="title-highlight">الخدمات المميزة</span>
            </h2>
          </div>
          <div className="rituals-menu">
            {isLoadingServices ? (
              <div className="loading-dots">بيحمل الخدمات...</div>
            ) : (
              <>
                {/* Desktop list */}
                <div className="menu-columns">
                  {services.map(service => (
                    <div key={service.id} className="menu-item">
                      <div className="menu-item-top">
                        <h4 className="menu-item-name">{service.name}</h4>
                        <div className="menu-item-dots"></div>
                        <span className="menu-item-price">${service.price.toFixed(2)}</span>
                      </div>
                      {service.description && (
                        <p className="menu-item-desc">{service.description}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Mobile card grid */}
                {/* Mobile infinite-loop marquee */}
                <div 
                  className="menu-cards-marquee"
                  ref={realMarqueeRef}
                  onTouchStart={pauseMarquee}
                  onTouchEnd={resumeMarquee}
                  onMouseEnter={pauseMarquee}
                  onMouseLeave={resumeMarquee}
                  onMouseDown={pauseMarquee}
                  onMouseUp={resumeMarquee}
                >
                  <div className="menu-cards-track">
                    {/* original set */}
                    {services.map(service => (
                      <div key={service.id} className="menu-card">
                        <h4 className="menu-card-name">{service.name}</h4>
                        {service.description && (
                          <p className="menu-card-desc">{service.description}</p>
                        )}
                        <span className="menu-card-price">${service.price.toFixed(2)}</span>
                      </div>
                    ))}
                    {/* duplicate set for seamless loop */}
                    {services.map(service => (
                      <div key={`dup-${service.id}`} className="menu-card">
                        <h4 className="menu-card-name">{service.name}</h4>
                        {service.description && (
                          <p className="menu-card-desc">{service.description}</p>
                        )}
                        <span className="menu-card-price">${service.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </>
            )}
          </div>
        </div>
      </section>

      {/* ====== CTA BANNER ====== */}
      <section className="mrx-cta" id="about">
        <div className="cta-content">
          <h2 className="cta-heading">كرسيك مستنيك.</h2>
          <button className="btn-primary-pill cta-btn-large" onClick={() => navigate('/barbers')}>
            احجز ميعادك دلوقتي
          </button>
        </div>
      </section>

    </div>
  );
}
