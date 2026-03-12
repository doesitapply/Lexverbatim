import React, { useState, useRef } from 'react';
import { Layout, Mic, Users, Download, Settings, Activity, Menu, X, FileBox, Upload, Terminal, Cpu } from 'lucide-react';
import { LegalCase, Speaker, TranscriptBlock, SpeakerRole, Exhibit } from './types';
import { LegalPage } from './components/LegalPage';
import { INITIAL_CASE } from './services/mockData';
import { scanForExhibits, streamTranscription } from './services/geminiService';

// --- Helper Components ---
const TerminalButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }> = ({ children, variant = 'primary', className = '', ...props }) => {
  const base = "font-mono uppercase text-xs tracking-wider px-4 py-2 border transition-all duration-200 flex items-center gap-2 relative overflow-hidden group";
  const variants = {
    primary: "border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]",
    secondary: "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200",
    danger: "border-rose-500/50 text-rose-400 hover:bg-rose-500/10 hover:border-rose-400"
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      <div className="absolute inset-0 bg-current opacity-0 group-hover:opacity-5 transition-opacity" />
    </button>
  );
};

// --- Utils ---
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

const App: React.FC = () => {
  const [activeCase, setActiveCase] = useState<LegalCase>(INITIAL_CASE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'upload' | 'editor'>('upload');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // We handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await processFile(file);
    }
  };

  // Main Processing Logic
  const processFile = async (file: File) => {
    try {
      setIsProcessing(true);
      // We do NOT switch viewMode yet. We show the processing overlay on top or replace the upload view.
      
      // Initialize accumulator structures (Transient State)
      // This prevents React re-renders for every line of text.
      let currentMeta = { ...INITIAL_CASE.meta, caseName: file.name, date: new Date().toLocaleDateString() };
      let currentSpeakers: Record<string, Speaker> = {};
      let currentBlocks: TranscriptBlock[] = [];
      let currentExhibits: Exhibit[] = [];
      let speakerNameMap: Record<string, string> = {}; // Name -> ID

      const base64 = await fileToBase64(file);
      const stream = streamTranscription(base64, file.type);
      
      let buffer = "";

      // Consume the stream
      for await (const chunk of stream) {
        if (!chunk) continue;
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            
            // --- Logic extracted from previous addTranscriptSegment ---
            const { speakerName, role, text, confidence, isQuestion } = data;
            if (!text || !speakerName) continue;

            // 1. Resolve Speaker
            let speakerId = speakerNameMap[speakerName];
            if (!speakerId) {
              const nextIdx = Object.keys(currentSpeakers).length;
              speakerId = `SPK_${nextIdx}`;
              speakerNameMap[speakerName] = speakerId;
              
              let displayTag = speakerName.toUpperCase();
              if (role === 'WITNESS') displayTag = 'A';
              else if (isQuestion || role?.includes('ATTORNEY')) {
                   displayTag = isQuestion ? 'Q' : `MR. ${speakerName.split(' ').pop()?.toUpperCase()}`;
              }

              currentSpeakers[speakerId] = {
                id: speakerId,
                name: speakerName,
                role: role as SpeakerRole || SpeakerRole.UNKNOWN,
                displayTag: displayTag
              };
            }

            // 2. Create Block
            const blockId = `b_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const now = new Date(); // In real app, Gemini would provide timestamps
            const timeString = now.toLocaleTimeString('en-US', { hour12: false });
            
            const content = text.split(' ').map((w: string) => ({
              text: w,
              start: 0,
              end: 0,
              confidence: confidence || 0.95
            }));

            const newBlock: TranscriptBlock = {
              id: blockId,
              speakerId,
              type: role === 'THE_COURT' || role === 'VIDEOGRAPHER' ? 'colloquy' : 'testimony',
              speakerConfidence: confidence || 0.9,
              content,
              timestampDisplay: timeString
            };

            // 3. Scan Exhibits
            const foundExhibits = scanForExhibits(text, blockId, timeString);
            
            // Update accumulators
            currentBlocks.push(newBlock);
            currentExhibits.push(...foundExhibits);

          } catch (err) {
            // Ignore partial JSON
          }
        }
      }

      // Final State Update
      setActiveCase({
        meta: currentMeta,
        speakers: currentSpeakers,
        blocks: currentBlocks,
        exhibits: currentExhibits
      });
      setViewMode('editor');

    } catch (error) {
      console.error("Transcription failed", error);
      alert("Error processing file. Please check console.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[#050505] text-slate-300 font-mono overflow-hidden relative">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
        accept="audio/*,video/*"
      />

      {/* Background Ambience */}
      <div className="scanline"></div>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>

      {/* Header */}
      <header className="h-14 border-b border-slate-800 bg-[#050505]/90 backdrop-blur flex items-center justify-between px-4 lg:px-6 z-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center relative">
            <Activity className={`w-4 h-4 text-cyan-400 ${isProcessing ? 'animate-pulse' : ''}`} />
            {isProcessing && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></span>}
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-widest text-white leading-none">LEX<span className="text-cyan-400">VERBATIM</span></h1>
            <div className="text-[10px] text-slate-500 tracking-[0.2em] uppercase">High-Fidelity Legal AI</div>
          </div>
        </div>
        
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs text-slate-500 border border-slate-800 px-3 py-1 rounded-full">
            <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-500 animate-pulse' : 'bg-slate-700'}`}></div>
            STATUS: {isProcessing ? 'COMPILING DATA...' : 'SYSTEM READY'}
          </div>
          <button className="hover:text-cyan-400 transition-colors"><Settings className="w-5 h-5" /></button>
          <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center text-xs font-bold border border-slate-700">OP</div>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-slate-400" onClick={() => setShowMobileMenu(!showMobileMenu)}>
          {showMobileMenu ? <X /> : <Menu />}
        </button>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Mobile Drawer */}
        {showMobileMenu && (
          <div className="absolute inset-0 bg-black/95 z-40 p-6 flex flex-col gap-4 md:hidden">
             <div className="border-b border-slate-800 pb-4 mb-2 text-cyan-500 font-bold">SYSTEM MENU</div>
             <button className="flex items-center gap-3 text-slate-300 py-2"><Layout className="w-5 h-5"/> Dashboard</button>
             <button className="flex items-center gap-3 text-slate-300 py-2"><FileBox className="w-5 h-5"/> Exhibits</button>
             <button className="flex items-center gap-3 text-slate-300 py-2"><Users className="w-5 h-5"/> Speakers</button>
          </div>
        )}

        {/* Processing Overlay */}
        {isProcessing && (
           <div className="absolute inset-0 z-50 bg-[#050505] flex flex-col items-center justify-center">
              <div className="relative mb-8">
                 <div className="w-24 h-24 border-2 border-cyan-500/20 rounded-full animate-[spin_3s_linear_infinite]"></div>
                 <div className="w-24 h-24 border-2 border-t-cyan-500 rounded-full animate-[spin_2s_linear_infinite] absolute top-0 left-0"></div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Cpu className="w-8 h-8 text-cyan-500 animate-pulse" />
                 </div>
              </div>
              <h2 className="text-xl font-bold text-white tracking-widest mb-2 animate-pulse">PROCESSING ARTIFACTS</h2>
              <p className="text-slate-500 text-xs font-mono tracking-wider">GEMINI NEURAL ENGINE ACTIVE</p>
              <div className="mt-8 w-64 h-1 bg-slate-800 rounded overflow-hidden">
                 <div className="h-full bg-cyan-500 animate-[translateX_1.5s_ease-in-out_infinite] w-1/3"></div>
              </div>
           </div>
        )}

        {!isProcessing && viewMode === 'upload' && (
           <main className="flex-1 flex flex-col items-center justify-center p-6 bg-[#050505] relative">
               <div className="max-w-lg w-full glass-panel p-8 md:p-12 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                  
                  <div className="text-center relative z-10">
                     <div className="w-20 h-20 border border-cyan-500/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(6,182,212,0.1)] group-hover:shadow-[0_0_50px_rgba(6,182,212,0.2)] transition-shadow">
                        <Mic className="w-8 h-8 text-cyan-400" />
                     </div>
                     <h2 className="text-2xl text-white font-bold mb-2 tracking-tight">INITIATE SESSION</h2>
                     <p className="text-slate-500 text-sm mb-8">Upload audio/video evidence for analysis.</p>
                     
                     <TerminalButton className="w-full justify-center py-4 text-sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-5 h-5" /> Select Artifact
                     </TerminalButton>
                     
                     <div className="mt-6 flex justify-center gap-4 text-[10px] text-slate-600 font-mono">
                        <span>MP4/WAV</span>
                        <span>•</span>
                        <span>SECURE CHANNEL</span>
                        <span>•</span>
                        <span>GEMINI 2.5</span>
                     </div>
                  </div>
               </div>
           </main>
        )}

        {!isProcessing && viewMode === 'editor' && (
          <>
            {/* Left Sidebar (Desktop) */}
            <aside className="hidden md:flex w-72 flex-col border-r border-slate-800 bg-[#080808]">
              {/* Exhibits */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0 border-b border-slate-800">
                 <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-cyan-400 tracking-wider flex items-center gap-2">
                      <FileBox className="w-3 h-3" /> EVIDENCE LOG
                    </h3>
                    <span className="text-[10px] bg-cyan-900/30 text-cyan-300 px-1.5 py-0.5 rounded">{activeCase.exhibits.length}</span>
                 </div>
                 <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {activeCase.exhibits.length === 0 ? (
                      <div className="text-center py-10 text-slate-600 text-xs italic">
                        No exhibits detected.
                      </div>
                    ) : (
                      activeCase.exhibits.map((ex) => (
                        <div key={ex.id} className="bg-slate-900/40 border border-slate-800 p-3 hover:border-cyan-500/30 transition-colors group cursor-pointer">
                           <div className="flex justify-between items-start mb-1">
                              <span className="text-cyan-300 font-bold text-sm">{ex.label}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{ex.timestamp}</span>
                           </div>
                           <div className="text-[10px] text-slate-500 group-hover:text-slate-400">
                              Detected in testimony.
                           </div>
                        </div>
                      ))
                    )}
                 </div>
              </div>

              {/* Speakers */}
              <div className="h-1/3 flex flex-col overflow-hidden">
                 <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                    <h3 className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-2">
                      <Users className="w-3 h-3" /> DIARIZATION
                    </h3>
                 </div>
                 <div className="flex-1 overflow-y-auto p-2">
                    {Object.values(activeCase.speakers).map((spk: Speaker) => (
                      <div key={spk.id} className="flex items-center justify-between p-2 text-xs border-b border-slate-800/50 last:border-0">
                        <span className="text-slate-300">{spk.name}</span>
                        <span className="bg-slate-800 text-slate-400 px-1.5 rounded">{spk.displayTag}</span>
                      </div>
                    ))}
                 </div>
              </div>
            </aside>

            {/* Editor Main */}
            <main className="flex-1 flex flex-col bg-[#050505] relative">
                {/* Toolbar */}
                <div className="h-12 border-b border-slate-800 flex items-center justify-between px-4 bg-[#050505]/50 backdrop-blur z-20">
                   <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-500">
                        CASE: <span className="text-cyan-500">{activeCase.meta.caseName}</span>
                      </span>
                      <div className="h-4 w-px bg-slate-800"></div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600 uppercase">Confidence</span>
                        <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-500 w-[94%] shadow-[0_0_10px_cyan]"></div>
                        </div>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-3">
                      <TerminalButton variant="secondary" className="h-8">
                         <Download className="w-3 h-3" /> Export
                      </TerminalButton>
                   </div>
                </div>

                {/* Document Canvas */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 bg-[#0a0a0a] relative">
                   <div className="flex flex-col items-center min-h-full">
                      <LegalPage 
                        caseData={activeCase} 
                        startBlockIndex={0} 
                        pageNumber={1} 
                      />
                      {activeCase.blocks.length > 6 && (
                         <LegalPage 
                           caseData={activeCase} 
                           startBlockIndex={6} 
                           pageNumber={2} 
                         />
                      )}
                      {activeCase.blocks.length === 0 && (
                        <div className="text-slate-600 mt-20">No transcription data found.</div>
                      )}
                   </div>
                </div>
            </main>
          </>
        )}

      </div>
    </div>
  );
};

export default App;