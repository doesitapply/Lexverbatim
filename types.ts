import React from 'react';

export enum SpeakerRole {
  WITNESS = 'WITNESS',
  ATTORNEY_PLAINTIFF = 'ATTORNEY_PLAINTIFF',
  ATTORNEY_DEFENSE = 'ATTORNEY_DEFENSE',
  THE_COURT = 'THE_COURT', // Judge
  VIDEOGRAPHER = 'VIDEOGRAPHER',
  UNKNOWN = 'UNKNOWN'
}

export interface Speaker {
  id: string;
  name: string;
  role: SpeakerRole;
  displayTag: string; // "Q", "A", "MR. JONES", "THE COURT"
}

export interface Word {
  text: string;
  start: number;
  end: number;
  confidence: number; // 0.0 to 1.0
}

export interface Exhibit {
  id: string;
  label: string; // "Exhibit 1"
  description?: string;
  detectedAtBlockId: string;
  timestamp: string;
}

export interface TranscriptBlock {
  id: string;
  speakerId: string;
  speakerConfidence?: number; // 0.0 to 1.0 - Diarization confidence
  type: 'testimony' | 'colloquy' | 'parenthetical';
  content: Word[];
  startFrame?: number; // Calculated for video sync
  timestampDisplay?: string; // e.g., "10:04:23"
}

export interface CaseMetadata {
  caseName: string;
  caseNumber: string;
  deponent: string;
  date: string;
  fps: number; // e.g., 29.97
}

export interface LegalCase {
  meta: CaseMetadata;
  speakers: Record<string, Speaker>;
  blocks: TranscriptBlock[];
  exhibits: Exhibit[];
}

export interface PageLayout {
  pageNumber: number;
  lines: {
    lineNumber: number;
    content: React.ReactNode;
    timestamp?: string;
  }[];
}