import React, { useState, useEffect } from 'react';
import { loadCustomLogo } from '@/lib/storage';

interface LogoEmblemProps {
  size?: number; // size in px
  className?: string;
}

export const LogoEmblem: React.FC<LogoEmblemProps> = ({ size = 48, className = '' }) => {
  const [customLogo, setCustomLogo] = useState<string | null>(() => loadCustomLogo());

  useEffect(() => {
    const handleCustomLogoChange = () => {
      setCustomLogo(loadCustomLogo());
    };

    window.addEventListener('custom-logo-changed', handleCustomLogoChange);
    return () => {
      window.removeEventListener('custom-logo-changed', handleCustomLogoChange);
    };
  }, []);

  if (customLogo) {
    return (
      <div
        style={{ width: `${size}px`, height: `${size}px` }}
        className={`relative inline-block select-none rounded-full shadow-md shrink-0 border-2 border-[#D4AF37] overflow-hidden bg-white/10 ${className}`}
      >
        <img
          src={customLogo}
          alt="Logo da Igreja / Sistema"
          className="w-full h-full object-cover rounded-full"
        />
      </div>
    );
  }

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`relative inline-block select-none rounded-full shadow-md shrink-0 ${className}`}
    >
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full rounded-full overflow-hidden"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Burgundy Outer Ring Gradient */}
          <linearGradient id="burgundyRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4a121f" />
            <stop offset="50%" stopColor="#6b1d2f" />
            <stop offset="100%" stopColor="#2c0911" />
          </linearGradient>

          {/* Gold Metallic Gradient */}
          <linearGradient id="goldMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffe680" />
            <stop offset="25%" stopColor="#d4af37" />
            <stop offset="50%" stopColor="#fff2a8" />
            <stop offset="75%" stopColor="#c5a028" />
            <stop offset="100%" stopColor="#8a6e12" />
          </linearGradient>

          {/* Gold Inner Ring */}
          <linearGradient id="goldRing" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d4af37" />
            <stop offset="50%" stopColor="#fff5cc" />
            <stop offset="100%" stopColor="#c5a028" />
          </linearGradient>

          {/* Marble Subtle Radial Filter */}
          <radialGradient id="marbleBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="85%" stopColor="#f7f3eb" />
            <stop offset="100%" stopColor="#ede6d8" />
          </radialGradient>

          {/* Subtle Drop Shadow */}
          <filter id="goldShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#380d17" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* 1. Burgundy Marble Outer Ring */}
        <circle cx="100" cy="100" r="98" fill="url(#burgundyRing)" stroke="#1a0409" strokeWidth="2" />

        {/* Outer Ring Gold Bezel */}
        <circle cx="100" cy="100" r="88" fill="none" stroke="url(#goldRing)" strokeWidth="2.5" />

        {/* 2. White Marble Inner Core */}
        <circle cx="100" cy="100" r="85" fill="url(#marbleBg)" />

        {/* Fine Marble Texture Wave Lines */}
        <path
          d="M 25 80 Q 70 60 100 85 T 175 75"
          fill="none"
          stroke="#e3d9c6"
          strokeWidth="1"
          strokeOpacity="0.6"
        />
        <path
          d="M 30 120 Q 80 140 110 115 T 170 125"
          fill="none"
          stroke="#e3d9c6"
          strokeWidth="1"
          strokeOpacity="0.5"
        />
        <path
          d="M 40 50 Q 100 40 160 55"
          fill="none"
          stroke="#eae0d0"
          strokeWidth="0.75"
          strokeOpacity="0.5"
        />

        {/* Inner Gold Frame Border */}
        <circle cx="100" cy="100" r="82" fill="none" stroke="url(#goldMetallic)" strokeWidth="1" strokeOpacity="0.8" />

        {/* 3. Central 3D Metallic Gold Emblem - Open Bible + Sabbath School Wave / Cross Symbol */}
        <g filter="url(#goldShadow)">
          {/* Open Bible Pages (Left Page & Right Page) */}
          <path
            d="M 48 115 C 65 105 85 108 97 122 L 97 78 C 85 64 65 61 48 72 Z"
            fill="url(#goldMetallic)"
          />
          <path
            d="M 152 115 C 135 105 115 108 103 122 L 103 78 C 115 64 135 61 152 72 Z"
            fill="url(#goldMetallic)"
          />

          {/* Book Spine Center Accent */}
          <path d="M 97 76 L 103 76 L 103 124 L 97 124 Z" fill="#6b1d2f" />

          {/* Abstract Rising Rays / Flames above Bible */}
          <path
            d="M 100 42 C 105 52 112 58 122 62 C 110 64 104 70 100 78 C 96 70 90 64 78 62 C 88 58 95 52 100 42 Z"
            fill="url(#goldMetallic)"
          />

          {/* Central Sabbath School Globe / Ring Line */}
          <ellipse
            cx="100"
            cy="92"
            rx="28"
            ry="10"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeOpacity="0.9"
          />

          {/* Cross / Light rays in the middle */}
          <path
            d="M 100 68 L 100 106 M 86 86 L 114 86"
            stroke="url(#goldMetallic)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
};
