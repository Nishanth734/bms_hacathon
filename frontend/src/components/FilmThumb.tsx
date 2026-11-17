import React, { useState } from 'react';

interface FilmThumbProps {
  src: string;
  alt: string;
  frameNumber?: number;
}

export const FilmThumb: React.FC<FilmThumbProps> = ({ src, alt, frameNumber }) => {
  const [error, setError] = useState(false);

  return (
    <div className="relative w-11 h-11 bg-[#12171B] border border-[#26303A] rounded-[2px] overflow-hidden flex items-center justify-center group flex-shrink-0">
      {/* Contact Sheet Frame Number */}
      {frameNumber !== undefined && (
        <span className="absolute top-0.5 left-0.5 text-[8px] font-mono-num text-[#66727D] leading-none z-10 select-none bg-[#0B0E11]/80 px-0.5 rounded-[1px]">
          #{frameNumber}
        </span>
      )}

      {!error ? (
        <img
          src={src}
          alt={alt}
          onError={() => setError(true)}
          className="w-full h-full object-cover filter grayscale contrast-125 group-hover:scale-105 transition-transform duration-200"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#1A2127] text-[#66727D]">
          <span className="text-[9px] font-mono-num">CXR</span>
        </div>
      )}

      {/* Film Corner Notch simulation */}
      <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#0B0E11] rotate-45 transform translate-x-1 translate-y-1 pointer-events-none" />
    </div>
  );
};
