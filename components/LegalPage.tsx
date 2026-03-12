import React, { useRef, useEffect, useState } from 'react';
import { LegalCase } from '../types';

interface LegalPageProps {
  caseData: LegalCase;
  startBlockIndex: number;
  pageNumber: number;
  linesPerPage?: number;
}

export const LegalPage: React.FC<LegalPageProps> = ({ 
  caseData, 
  startBlockIndex, 
  pageNumber, 
  linesPerPage = 25 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Responsive Scaling Logic
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        // Standard width of legal page in pixels (8.5in * 96dpi approx 816px)
        const STANDARD_WIDTH = 816;
        const parentWidth = containerRef.current.parentElement?.clientWidth || STANDARD_WIDTH;
        
        // Add some padding margin consideration
        const availableWidth = parentWidth - 40; 
        
        // Calculate scale, maxing out at 1.2 for large screens, min unbounded
        const newScale = Math.min(availableWidth / STANDARD_WIDTH, 1.2);
        setScale(newScale);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Init

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const blocks = caseData.blocks.slice(startBlockIndex, startBlockIndex + 6); 

  return (
    <div ref={containerRef} className="flex justify-center mb-8 origin-top" style={{ height: `${1150 * scale}px` }}>
      <div 
        className="relative bg-white shadow-[0_0_50px_rgba(0,0,0,0.5)] text-black transition-transform duration-200 ease-out" 
        style={{ 
          width: '8.5in', 
          height: '11in', 
          padding: '0.5in',
          transform: `scale(${scale})`,
          transformOrigin: 'top center'
        }}
      >
        
        {/* Page Header */}
        <div className="absolute top-4 right-8 font-legal text-xs text-gray-500">
          Page {pageNumber}
        </div>
        <div className="absolute top-4 left-8 font-legal text-xs text-gray-500">
          {caseData.meta.caseNumber} - {caseData.meta.deponent}
        </div>

        {/* Main Content Area with Grid */}
        <div className="flex h-full border border-gray-200 relative">
          
          {/* Line Numbers (Left Margin) */}
          <div className="w-12 border-r border-gray-300 h-full flex flex-col pt-1 bg-gray-50 select-none">
            {Array.from({ length: linesPerPage }).map((_, i) => (
              <div key={i} className="flex-1 font-legal text-xs text-gray-400 text-center flex items-center justify-center">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Text Body */}
          <div className="flex-1 px-4 py-1 flex flex-col h-full font-legal text-sm leading-loose relative">
            
            {blocks.map((block) => {
              const speaker = caseData.speakers[block.speakerId];
              const isQA = speaker?.displayTag === 'Q' || speaker?.displayTag === 'A';
              const isColloquy = block.type === 'colloquy';

              return (
                <div key={block.id} className="mb-4">
                  <div className="flex">
                    {/* Speaker Label */}
                    <div className={`shrink-0 font-bold ${isColloquy ? 'mr-2' : 'w-12'}`}>
                      {speaker ? (
                         isColloquy ? `${speaker.displayTag}:` : `${speaker.displayTag}.`
                      ) : 'Unknown'}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 flex flex-wrap gap-x-1.5">
                       {block.content.map((word, wIdx) => {
                         const isExhibit = word.text.includes("Exhibit");
                         return (
                           <span 
                            key={wIdx} 
                            className={`
                              ${word.confidence < 0.8 ? 'bg-amber-100 decoration-amber-500 underline decoration-wavy' : ''} 
                              ${isExhibit ? 'bg-green-100 border-b-2 border-green-500 font-bold' : ''}
                              cursor-text hover:bg-blue-50 rounded px-0.5
                            `}
                            title={`Confidence: ${Math.round(word.confidence * 100)}%`}
                           >
                             {word.text}
                           </span>
                         );
                       })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Timestamp gutter (Right Margin Overlay) */}
            <div className="absolute right-0 top-0 h-full w-16 opacity-50 pointer-events-none border-l border-dashed border-gray-200">
               {blocks.map((block, i) => (
                  <div key={i} className="absolute right-1 text-[10px] text-blue-600 font-mono" style={{ top: `${i * 15}%` }}>
                    {block.timestampDisplay}
                  </div>
               ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};