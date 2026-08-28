import './Logo.css';

interface LogoProps {
  className?: string;
  onClick?: () => void;
}

export default function Logo({ className = '', onClick }: LogoProps) {
  return (
    <div className={`mrx-brand-logo ${className}`} onClick={onClick}>
      <div className="mrx-brand-top">
        <span className="mrx-text">MR</span>
        <span className="mrx-dot">.</span>
        <span className="mrx-x">
          X
          {/* Subtle scissors icon overlaid or next to X for the barbershop feel */}
          <svg className="mrx-x-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-4.879-4.879l-4.242-4.242m4.242 4.242L19 9.243M9.879 9.879l-4.242 4.242m4.242-4.242L5 5m4.879 4.879a3 3 0 104.242 4.242 3 3 0 00-4.242-4.242z" />
          </svg>
        </span>
      </div>
      <div className="mrx-brand-bottom">BARBER</div>
    </div>
  );
}
