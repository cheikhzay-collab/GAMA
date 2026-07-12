import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function WhatsAppButton() {
  const { whatsappSettings, profPhone } = useAuth();
  const location = useLocation();
  const [hovered, setHovered] = useState(false);

  // If WhatsApp settings are disabled, don't show the button
  if (!whatsappSettings || !whatsappSettings.enabled) {
    return null;
  }

  // Determine the target phone number
  const rawPhone = whatsappSettings.phoneNumber || profPhone;
  if (!rawPhone) {
    return null;
  }

  // Sanitize the phone number: keep only digits for the wa.me API
  const cleanPhone = rawPhone.replace(/[^\d]/g, '');
  if (!cleanPhone) {
    return null;
  }

  const message = whatsappSettings.message || '';
  const position = whatsappSettings.position === 'left' ? 'left' : 'right';
  const tooltipText = whatsappSettings.tooltipText || 'Contactez-nous';

  // Check if mobile navigation is active on the current page
  const focusRoutes = ['/exam', '/study'];
  const isFocusMode = focusRoutes.some(r => location.pathname.startsWith(r)) || location.pathname.endsWith('/edit');
  const isPublicPage = ['/', '/login', '/register', '/auth/callback', '/print'].some(p => 
    location.pathname === p || location.pathname.startsWith('/auth/callback')
  );
  
  // Mobile nav is active for logged-in students on non-focus routes
  const hasMobileNav = !isPublicPage && !isFocusMode;

  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .whatsapp-floating-btn {
          position: fixed;
          bottom: 24px;
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
          box-shadow: 0 4px 16px rgba(18, 140, 126, 0.4), 0 0 0 0 rgba(37, 211, 102, 0.4);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: none;
          outline: none;
          text-decoration: none;
          color: #fff;
          animation: whatsappPulseAnimation 2.2s infinite;
        }

        .whatsapp-floating-btn:hover {
          transform: scale(1.1) translateY(-2px);
          background: linear-gradient(135deg, #34e073 0%, #14a090 100%);
          box-shadow: 0 8px 24px rgba(18, 140, 126, 0.55), 0 0 0 10px rgba(37, 211, 102, 0);
          animation: none; /* Stop pulsing on hover */
        }

        .whatsapp-tooltip-bubble {
          position: fixed;
          bottom: 32px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-main);
          padding: 8px 14px;
          border-radius: 12px;
          font-size: 0.82rem;
          font-weight: 700;
          box-shadow: var(--shadow-card);
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 998;
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .whatsapp-tooltip-bubble::after {
          content: '';
          position: absolute;
          bottom: 50%;
          transform: translateY(50%) rotate(45deg);
          width: 8px;
          height: 8px;
          background: var(--bg-card);
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        /* Positions adjustments */
        .pos-right {
          right: 24px;
        }
        .pos-left {
          left: 24px;
        }

        .tooltip-right {
          right: 90px;
          transform: translateX(10px);
        }
        .tooltip-right::after {
          right: -5px;
          border-right: 1px solid var(--border);
          border-bottom: none;
          border-top: 1px solid var(--border);
          transform: translateY(50%) rotate(45deg);
        }

        .tooltip-left {
          left: 90px;
          transform: translateX(-10px);
        }
        .tooltip-left::after {
          left: -5px;
          border-left: 1px solid var(--border);
          border-top: 1px solid var(--border);
          border-right: none;
          border-bottom: none;
          transform: translateY(50%) rotate(45deg);
        }

        .tooltip-show {
          opacity: 1 !important;
          transform: translateX(0) !important;
        }

        /* Pulse wave animation */
        @keyframes whatsappPulseAnimation {
          0% {
            box-shadow: 0 4px 16px rgba(18, 140, 126, 0.4), 0 0 0 0 rgba(37, 211, 102, 0.6);
          }
          70% {
            box-shadow: 0 4px 16px rgba(18, 140, 126, 0.3), 0 0 0 16px rgba(37, 211, 102, 0);
          }
          100% {
            box-shadow: 0 4px 16px rgba(18, 140, 126, 0.4), 0 0 0 0 rgba(37, 211, 102, 0);
          }
        }

        /* Adjust bottom position on mobile screens with navigation bar */
        @media (max-width: 768px) {
          .whatsapp-floating-btn.has-mobile-nav {
            bottom: 80px;
          }
          .whatsapp-tooltip-bubble.has-mobile-nav {
            bottom: 88px;
          }
        }
      `}} />

      {/* Floating Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`whatsapp-floating-btn pos-${position} ${hasMobileNav ? 'has-mobile-nav' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Contact support on WhatsApp"
      >
        <svg
          viewBox="0 0 448 512"
          width="26"
          height="26"
          fill="currentColor"
          style={{ transform: 'translateY(1px)' }}
        >
          <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
        </svg>
      </a>

      {/* Tooltip Bubble */}
      <div
        className={`whatsapp-tooltip-bubble tooltip-${position} ${hovered ? 'tooltip-show' : ''} ${hasMobileNav ? 'has-mobile-nav' : ''}`}
      >
        <span style={{ fontSize: '1rem', transform: 'translateY(-1px)' }}>💬</span>
        {tooltipText}
      </div>
    </>
  );
}
