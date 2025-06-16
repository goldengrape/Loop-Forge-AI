
import { GoogleGenAI, Part, GenerateContentParameters, GenerateContentResponse, Type, UsageMetadata } from "@google/genai";
import { ReviewerMultiReviewResponse, WriterMultiDraftOutput, SingleDraftReview, WriterDraft } from '../types';

// API_KEY is expected to be an environment variable (process.env.API_KEY).
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface LocalSchemaProperty {
  type: Type;
  description?: string;
  format?: string;
  nullable?: boolean;
  enum?: string[];
  properties?: Record<string, LocalSchemaProperty>;
  required?: string[];
  items?: LocalSchemaProperty;
}

type LocalResponseSchema = LocalSchemaProperty;

interface GenerateConfig {
  systemInstruction?: string;
  topK?: number;
  topP?: number;
  temperature?: number;
  responseMimeType?: "text/plain" | "application/json";
  responseSchema?: LocalResponseSchema;
}

export interface GenerateContentResultWithTokens {
  text: string;
  usageMetadata?: UsageMetadata;
}

export const generateContent = async (
  modelName: string,
  contents: Part[] | string,
  config?: GenerateConfig
): Promise<GenerateContentResultWithTokens> => {
  try {
    const params: GenerateContentParameters = {
      model: modelName,
      contents: [],
    };

    if (typeof contents === 'string') {
        params.contents = [{role: "user", parts: [{text: contents}]}];
    } else {
        if (Array.isArray(contents) && contents.every(p => p.hasOwnProperty('text') || p.hasOwnProperty('inlineData'))) {
             params.contents = [{role: "user", parts: contents}];
        } else {
            console.warn("Contents structure might be incorrect, wrapping in standard user role. Contents:", contents);
            const validParts = Array.isArray(contents)
                ? contents.map(c => (typeof c === 'string' ? {text: c} : c)).filter(p => p.hasOwnProperty('text') || p.hasOwnProperty('inlineData'))
                : [{text: String(contents)}];
            params.contents = [{role: "user", parts: validParts as Part[]}];
        }
    }

    if (config) {
        params.config = {};
        if (config.systemInstruction) params.config.systemInstruction = config.systemInstruction;
        if (config.topK) params.config.topK = config.topK;
        if (config.topP) params.config.topP = config.topP;
        if (config.temperature) params.config.temperature = config.temperature;

        if (config.responseSchema) {
            params.config.responseSchema = config.responseSchema;
            params.config.responseMimeType = "application/json";
        } else if (config.responseMimeType) {
            params.config.responseMimeType = config.responseMimeType;
        }
    }

    const response: GenerateContentResponse = await ai.models.generateContent(params);

    let responseText: string;
    // Check if response.text is a function (streaming) or string (non-streaming)
    // For structured output with responseSchema, response.text should be the JSON string.
     if (typeof response.text === 'string') {
        responseText = response.text;
    } else if (typeof (response as any).text === 'function') { // Check if it's a stream-like object with a text() method
        console.warn("Gemini API returned a stream-like response, attempting to extract text. This is unexpected for structured output.");
        responseText = await (response as any).text(); // Assuming text() returns a Promise<string>
    }
     else {
        console.warn("Gemini API response.text is not a string or function, or is missing. Full response:", response);
        // Fallback for cases where text might be nested differently, though schema should prevent this.
        const candidateText = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if(typeof candidateText === 'string') {
            responseText = candidateText;
        } else {
            throw new Error("No text found in Gemini API response or response format is unexpected.");
        }
    }

    return {
        text: responseText,
        usageMetadata: response.usageMetadata
    };

  } catch (error: any) {
    console.error(`Error calling Gemini API (${modelName}):`, error);
    let errorMessage = `Gemini API Error: ${error.message || 'Unknown error'}`;
    if (error.toString().includes("API_KEY_INVALID") || (error.message && error.message.includes("API_KEY_INVALID"))) {
        errorMessage = "Gemini API Key is invalid or not authorized. Please check your API key configuration.";
    } else if (error.toString().includes("429") || (error.status === 429) || (error.message && error.message.includes("429"))) {
        errorMessage = "Gemini API quota exceeded or rate limit hit. Please try again later.";
    }
    if (error.message && (error.message.includes("response failed schema validation") || error.message.includes("Invalid response"))) {
        errorMessage = `Gemini API Error: Response failed schema validation. Details: ${error.message}`;
    }
    throw new Error(errorMessage);
  }
};

const parseJsonResponse = <T>(
    jsonString: string,
    validateFn: (parsed: any) => parsed is T,
    errorContext: string
) : T | null => {
    try {
        let cleanedJsonString = jsonString.trim();
        const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
        const match = cleanedJsonString.match(fenceRegex);
        if (match && match[1]) {
            cleanedJsonString = match[1].trim();
        }

        // eslint-disable-next-line no-control-regex
        cleanedJsonString = cleanedJsonString.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

        const parsed = JSON.parse(cleanedJsonString);

        if (validateFn(parsed)) {
            return parsed;
        }
        console.warn(`Parsed JSON does not match ${errorContext} structure:`, parsed, "Original string after sanitization:", cleanedJsonString);
        return null;
    } catch (error) {
        console.error(`Failed to parse ${errorContext} JSON response:`, error, "Raw string (after fence removal/sanitization):", jsonString);
        return null;
    }
}

export const parseReviewerResponse = (jsonString: string): ReviewerMultiReviewResponse | null => {
  return parseJsonResponse<ReviewerMultiReviewResponse>(
    jsonString,
    (p): p is ReviewerMultiReviewResponse => {
      if (!p || typeof p.selectedDraftIndex !== 'number' || typeof p.consolidatedFeedbackForNextIteration !== 'string' || !Array.isArray(p.draftReviews)) {
        return false;
      }
      if (p.selectedDraftIndex < 0 || p.selectedDraftIndex >= p.draftReviews.length) {
        if (p.draftReviews.length === 0 && p.selectedDraftIndex === -1) { // Special case for 0 drafts if API allows
             // Allow if no drafts and index is -1 (or some other indicator of no selection)
        } else {
            console.warn(`selectedDraftIndex ${p.selectedDraftIndex} is out of bounds for draftReviews array of length ${p.draftReviews.length}.`);
            return false;
        }
      }
      return p.draftReviews.every((review: any): review is SingleDraftReview =>
        review &&
        typeof review.reviewText === 'string' &&
        typeof review.score === 'number' &&
        review.score >= 0 && review.score <= 100
      );
    },
    "ReviewerMultiReviewResponse (expected draftReviews: SingleDraftReview[], selectedDraftIndex: number, consolidatedFeedbackForNextIteration: string)"
  );
};

export const parseWriterResponse = (jsonString: string): WriterMultiDraftOutput | null => {
  return parseJsonResponse<WriterMultiDraftOutput>(
    jsonString,
    (p): p is WriterMultiDraftOutput => {
      if (!p || typeof p.overallResponseToReview !== 'string' || !Array.isArray(p.drafts)) {
        return false;
      }
      return p.drafts.every((draft: any): draft is WriterDraft =>
        draft &&
        typeof draft.documentContent === 'string' &&
        typeof draft.revisionSummary === 'string'
      );
    },
    "WriterMultiDraftOutput (expected overallResponseToReview: string, drafts: WriterDraft[])"
  );
};
export { Type };
