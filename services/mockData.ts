import { LegalCase } from "../types";

export const INITIAL_CASE: LegalCase = {
    meta: {
      caseName: "New Transcription",
      caseNumber: "PENDING",
      deponent: "Unknown",
      date: new Date().toLocaleDateString(),
      fps: 29.97
    },
    speakers: {},
    exhibits: [],
    blocks: []
};