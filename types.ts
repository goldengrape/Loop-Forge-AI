
import { Part } from '@google/genai';

// For the Writer AI
export interface WriterDraft {
  documentContent: string;  // The main document/code for this specific draft
  revisionSummary: string;  // Summary of revisions made in this specific draft
}

export interface WriterMultiDraftOutput {
  overallResponseToReview: string; // Writer's direct response to the previous consolidated review
  drafts: WriterDraft[];           // Array of N generated drafts
}

// For the Reviewer AI
export interface SingleDraftReview {
  reviewText: string; // Detailed review comments for one specific draft
  score: number;      // A numerical score from 0 to 100 for that draft
}

export interface ReviewerMultiReviewResponse {
  draftReviews: SingleDraftReview[];             // Array of N reviews, one for each draft
  selectedDraftIndex: number;                  // 0-based index of the draft considered best
  consolidatedFeedbackForNextIteration: string; // Key overall feedback to guide the next writer cycle on the selected draft
}

// For Iteration Tracking
export interface UploadedFilePart {
  id: string;
  name: string;
  part: Part;
}

export interface IterationStep {
  id: number;
  writerInstructionLog: string;
  writerOutput: WriterMultiDraftOutput | null; // Updated to hold multiple drafts
  writerInputTokens?: number;   // Aggregate input tokens for generating N drafts
  writerOutputTokens?: number;  // Aggregate output tokens for generating N drafts
  review?: ReviewerMultiReviewResponse; // Updated to hold multi-review response
}

export enum AppStatus {
  Idle = "idle",
  Processing = "processing",
  Paused = "paused",
  Error = "error",
}

// Kept for backward compatibility if needed, but primary types are above for N-drafts
export interface ReviewerJsonResponse {
  reviewText: string;
  score: number; 
}

export interface WriterOutputJson {
  responseToReview: string; 
  documentContent: string;  
  revisionSummary: string;
}
