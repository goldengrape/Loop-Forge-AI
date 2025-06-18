# Module Design Document: Loop Forge迭代优化

## 1. Introduction

The Loop Forge迭代优化 is a web-based tool designed to assist users in the iterative generation and refinement of documents or code. It leverages the power of the Google Gemini API to simulate a collaborative process between an AI Writer and an AI Reviewer. Users provide background materials and initial prompts, and the application orchestrates a loop where the AI Writer generates content (multiple drafts per iteration), and the AI Reviewer provides feedback and scores. This cycle continues until user-defined criteria (e.g., target score, number of iterations) are met, or the user decides to manually guide the process.

**Core Purpose**: To streamline and enhance the quality of written or coded content through AI-driven, structured iteration and feedback.

**Core Technologies**:
*   **Frontend**: React, TypeScript
*   **Styling**: Tailwind CSS
*   **AI Backend**: Google Gemini API (`@google/genai` SDK)

## 2. High-Level Architecture

The application follows a component-based architecture typical of React applications, with a clear separation of concerns for UI, application logic, and service interactions.

```
+-----------------------------------+
|         User Interface            |
| (React Components - `App.tsx`)    |<-- User Interaction
+-----------------------------------+
             |        ^
             v        | (State Updates, Render UI)
+-----------------------------------+
|      Core Application Logic       |
| (`App.tsx` state & handlers)      |
+-----------------------------------+
             |        ^
             v        | (API Requests, Parsed Data)
+-----------------------------------+
|      Services (`geminiService.ts`)|
+-----------------------------------+
             |        ^
             v        | (Formatted API Calls, Raw Responses)
+-----------------------------------+
|      External: Google Gemini API  |
+-----------------------------------+
```

**Overall Data Flow**:
1.  User configures parameters and provides input (prompts, files) via the UI.
2.  The `App.tsx` component captures these inputs and manages the application state.
3.  On initiating the process, `App.tsx` orchestrates calls to `geminiService.ts`.
4.  `geminiService.ts` formats requests and communicates with the Google Gemini API.
5.  Responses from the Gemini API are parsed and validated by `geminiService.ts`.
6.  The parsed data (writer outputs, reviewer feedback, token counts) is returned to `App.tsx`.
7.  `App.tsx` updates its state, causing the UI to re-render and display the new information (e.g., new iteration step).
8.  The loop continues based on predefined conditions or user intervention.

## 3. Module Breakdown

The application is structured into several key modules and directories:

*   **`index.html` & `index.tsx` (Application Entry Point)**: Initializes and renders the React application.
*   **`App.tsx` (Core Application Logic & UI Orchestration)**: The main container component managing state, workflows, and high-level UI structure.
*   **`components/` (Reusable UI Elements)**:
    *   `Button.tsx`: A general-purpose button component.
    *   `FileUpload.tsx`: Handles file selection, processing, and conversion to Gemini `Part` objects.
    *   `IterationDisplay.tsx`: Renders the details of a single iteration, including multiple drafts and their reviews.
    *   `LoadingSpinner.tsx`: Visual indicator for asynchronous operations.
    *   `PromptInput.tsx`: A styled textarea for user prompts.
*   **`services/geminiService.ts` (Gemini API Interaction)**: Encapsulates all logic related to calling the Gemini API and parsing its responses.
*   **`types.ts` (Data Definitions)**: Contains all TypeScript interfaces and type definitions for data structures used throughout the application.
*   **`constants.ts` (Application-wide Constants)**: Stores static configuration values like model names and default parameters.
*   **`metadata.json`**: Contains application metadata like name, description and permissions.

## 4. Detailed Module Descriptions

### 4.1. `index.html` & `index.tsx`
*   **Purpose**: Entry point of the application.
*   **`index.html` Responsibilities**:
    *   Provides the basic HTML structure.
    *   Includes Tailwind CSS and custom fonts.
    *   Defines the root `div` for the React application.
    *   Sets up the import map for JavaScript modules.
    *   Loads the main `index.tsx` script.
*   **`index.tsx` Responsibilities**:
    *   Imports the main `App` component.
    *   Renders the `App` component into the HTML's root element.
    *   Wraps the `App` in `<React.StrictMode>`.
*   **Dependencies**: React, ReactDOM, `App.tsx`.

### 4.2. `App.tsx`
*   **Purpose**: The core component that orchestrates the entire application. It manages state, user interactions, and the iterative AI workflow.
*   **Responsibilities**:
    *   Manages global application state (background material, prompts, iteration parameters, iteration history, current status, error messages, token counts).
    *   Handles user input for configuration settings and prompts.
    *   Orchestrates the iterative calls to the AI writer and reviewer via `geminiService`.
    *   Processes and stores results from each iteration.
    *   Controls the flow of the application (start, pause, manual continue, reset).
    *   Renders the main layout and UI sections, delegating specific UI parts to child components.
    *   Validates user inputs.
    *   Provides functionality to download the final selected document.
*   **Key State Variables**:
    *   `backgroundMaterial`: `UploadedFilePart[]`
    *   `initialWriterPrompt`, `reviewerCriteria`: `string`
    *   `minIterationsInput`, `maxIterationsInput`, `targetScoreInput`, `numberOfDraftsInput`: `string` (user input for parameters)
    *   `iterationSteps`: `IterationStep[]`
    *   `currentStatus`: `AppStatus`
    *   `statusMessage`, `errorMessage`: `string | null`
    *   `currentMultiWriterOutput`: `WriterMultiDraftOutput | null`
    *   `currentReview`: `ReviewerMultiReviewResponse | null`
    *   `isReviewEditable`, `editableReviewComments`: `boolean`, `string`
    *   `totalInputTokensUsed`, `totalOutputTokensUsed`: `number`
*   **Key Functions**:
    *   `runIterations()`: Core logic for executing a batch of iterations (writer and reviewer calls).
    *   `startIterativeProcess()`: Initializes and starts the iterative loop.
    *   `handleManualContinue()`: Allows users to continue the process with edited feedback.
    *   `handleFileUpload()`: Callback for `FileUpload` component.
    *   `handleRemoveFile()`: Removes an uploaded file.
    *   `resetState()`: Resets the application to its initial state.
    *   `validateInputs()`: Validates user-provided iteration parameters.
    *   `downloadFinalDocument()`: Allows downloading the selected document.
*   **Dependencies**: React, `components/*`, `services/geminiService.ts`, `types.ts`, `constants.ts`.

### 4.3. `components/Button.tsx`
*   **Purpose**: Provides a styled, reusable button component.
*   **Responsibilities**:
    *   Render a `<button>` element.
    *   Apply consistent styling based on a `variant` prop.
    *   Handle `disabled` state and other standard button attributes.
*   **Inputs/Props**: `children`, `className`, `variant` ('primary', 'secondary', 'danger', 'success', 'warning'), standard HTML button attributes.
*   **Dependencies**: React.

### 4.4. `components/FileUpload.tsx`
*   **Purpose**: Enables users to upload background material files.
*   **Responsibilities**:
    *   Render a file input element.
    *   Handle multiple file selections.
    *   Read file content (text, or base64 for images/PDFs).
    *   Convert files into an array of `UploadedFilePart` objects (which include Gemini `Part` objects).
    *   Provide feedback messages to the user (e.g., number of files selected, upload success/error).
*   **Key Functions**: `fileToUploadedFilePart()` (async utility to process a single file).
*   **Inputs/Props**: `onFileUploaded` (callback function), `disabled` (boolean).
*   **Outputs/Callbacks**: Calls `onFileUploaded` with `UploadedFilePart[]`.
*   **Dependencies**: React, `Button.tsx`, `types.ts` (`UploadedFilePart`, `Part` from `@google/genai`).

### 4.5. `components/IterationDisplay.tsx`
*   **Purpose**: Displays the detailed information for a single iteration step.
*   **Responsibilities**:
    *   Visually present the iteration number and overall score of the selected draft.
    *   Show the writer's instructions/prompt for the current iteration.
    *   Display the writer's overall response to previous feedback.
    *   Render multiple drafts generated by the writer using a tab-like interface (via `DraftAndReviewCard`).
        *   Each draft card shows its revision summary and content.
        *   Each draft card also shows the specific review text and score if available.
    *   Highlight the draft selected by the reviewer.
    *   Show the reviewer's consolidated feedback for the next iteration.
    *   Display token usage for the writer's generation step.
*   **Key Internal Components**: `SectionTitle`, `SectionContentDisplay`, `DraftAndReviewCard`.
*   **Inputs/Props**: `step` (`IterationStep`), `isCurrentActiveStep` (boolean), `targetScore` (number).
*   **Dependencies**: React, `Button.tsx`, `types.ts` (`IterationStep`, `WriterDraft`, `SingleDraftReview`).

### 4.6. `components/LoadingSpinner.tsx`
*   **Purpose**: Provides a visual cue that a process is ongoing.
*   **Responsibilities**: Render an animated SVG spinner.
*   **Inputs/Props**: None.
*   **Dependencies**: React.

### 4.7. `components/PromptInput.tsx`
*   **Purpose**: A standardized textarea component for inputting prompts or other multi-line text.
*   **Responsibilities**:
    *   Render a `<label>` and `<textarea>`.
    *   Apply consistent styling.
    *   Handle `disabled` state.
*   **Inputs/Props**: `id`, `label`, `value`, `onChange`, `placeholder`, `disabled`.
*   **Dependencies**: React.

### 4.8. `services/geminiService.ts`
*   **Purpose**: Encapsulates all interactions with the Google Gemini API.
*   **Responsibilities**:
    *   Initialize the `GoogleGenAI` client with the API key (from `process.env.API_KEY`).
    *   Provide a `generateContent` function to make calls to the Gemini model.
        *   This function constructs the request payload, including model name, contents (prompts and file parts), and configuration (system instructions, response schema, temperature, etc.).
    *   Handle the `responseMimeType: "application/json"` and `responseSchema` for structured output.
    *   Parse JSON responses from the API:
        *   `parseWriterResponse()`: Parses and validates the writer's output against the `WriterMultiDraftOutput` schema.
        *   `parseReviewerResponse()`: Parses and validates the reviewer's output against the `ReviewerMultiReviewResponse` schema.
    *   Extract and return token usage metadata.
    *   Implement error handling for API calls (e.g., network issues, API key errors, quota limits, schema validation failures).
    *   Clean JSON strings (e.g., remove markdown fences) before parsing.
*   **Key Functions**:
    *   `generateContent()`: Asynchronously calls the Gemini API.
    *   `parseWriterResponse()`: Parses the AI writer's JSON output.
    *   `parseReviewerResponse()`: Parses the AI reviewer's JSON output.
*   **Interfaces**: Exports functions with defined parameters and return types (e.g., `GenerateContentResultWithTokens`).
*   **Dependencies**: `@google/genai` SDK, `types.ts`.

### 4.9. `types.ts`
*   **Purpose**: Central repository for all custom TypeScript type definitions and interfaces.
*   **Responsibilities**: Define the shape of data objects used throughout the application to ensure type safety and clarity.
*   **Key Types**: (See Section 5 for more details)
    *   `WriterDraft`, `WriterMultiDraftOutput`
    *   `SingleDraftReview`, `ReviewerMultiReviewResponse`
    *   `UploadedFilePart`
    *   `IterationStep`
    *   `AppStatus` (enum)
*   **Dependencies**: `@google/genai` (for `Part` type).

### 4.10. `constants.ts`
*   **Purpose**: Stores global constants and default configuration values.
*   **Responsibilities**: Centralize fixed values to improve maintainability and readability.
*   **Key Constants**:
    *   `GEMINI_MODEL_TEXT`: The Gemini model identifier.
    *   `DEFAULT_MIN_ITERATIONS`, `DEFAULT_MAX_ITERATIONS`, `DEFAULT_TARGET_SCORE`, `DEFAULT_NUMBER_OF_DRAFTS`.
*   **Dependencies**: None.

### 4.11. `metadata.json`
*   **Purpose**: Stores metadata about the application.
*   **Responsibilities**: Provides information like application name, description, and permissions required by the hosting environment.
*   **Key Fields**: `name`, `description`, `requestFramePermissions`, `prompt`.
*   **Dependencies**: None.


## 5. Data Structures (Key Types from `types.ts`)

*   **`UploadedFilePart`**: Represents a file uploaded by the user.
    ```typescript
    interface UploadedFilePart {
      id: string; // Unique identifier for the file part
      name: string; // Original file name
      part: Part; // Gemini API Part object (text or inlineData)
    }
    ```

*   **`WriterDraft`**: Represents a single draft generated by the AI writer.
    ```typescript
    interface WriterDraft {
      documentContent: string;
      revisionSummary: string;
    }
    ```

*   **`WriterMultiDraftOutput`**: Represents the complete output from the AI writer for one iteration, potentially containing multiple drafts.
    ```typescript
    interface WriterMultiDraftOutput {
      overallResponseToReview: string; // Response to previous consolidated feedback
      drafts: WriterDraft[]; // Array of generated drafts
    }
    ```

*   **`SingleDraftReview`**: Represents the AI reviewer's feedback and score for a single draft.
    ```typescript
    interface SingleDraftReview {
      reviewText: string;
      score: number; // 0-100
    }
    ```

*   **`ReviewerMultiReviewResponse`**: Represents the complete output from the AI reviewer for one iteration, including reviews for all drafts and consolidated feedback.
    ```typescript
    interface ReviewerMultiReviewResponse {
      draftReviews: SingleDraftReview[]; // Array of reviews, one per draft
      selectedDraftIndex: number; // 0-based index of the best draft
      consolidatedFeedbackForNextIteration: string; // Overall feedback for next writer iteration
    }
    ```

*   **`IterationStep`**: Represents a complete writer-reviewer cycle in the iteration history.
    ```typescript
    interface IterationStep {
      id: number; // Iteration number
      writerInstructionLog: string; // The prompt/instructions given to the writer
      writerOutput: WriterMultiDraftOutput | null;
      writerInputTokens?: number;
      writerOutputTokens?: number;
      review?: ReviewerMultiReviewResponse;
      // Reviewer token counts could be added here if needed per step
    }
    ```

*   **`AppStatus`**: Enum to track the current state of the application.
    ```typescript
    enum AppStatus {
      Idle = "idle",
      Processing = "processing",
      Paused = "paused",
      Error = "error",
    }
    ```

## 6. Core Workflows

### 6.1. Initial Setup & Configuration
1.  User accesses the application.
2.  User inputs:
    *   **Background Material**: Uploads files via `FileUpload.tsx`. These are converted to `UploadedFilePart[]` and stored in `App.tsx` state.
    *   **Initial Writer Prompt**: Enters text into `PromptInput.tsx` for `initialWriterPrompt`.
    *   **Reviewer Criteria**: Enters text into `PromptInput.tsx` for `reviewerCriteria`.
    *   **Iteration Parameters**: Sets values for min/max iterations, target score, and number of drafts per iteration using number input fields.
3.  `App.tsx` updates its state with these configurations.

### 6.2. Iterative Process Loop (triggered by "Start Iterative Process" or "Manual Continue")
This workflow is primarily managed by the `runIterations` function in `App.tsx`.

1.  **Input Validation**: `App.tsx` validates the iteration parameters. If invalid, an error message is shown.
2.  **Status Update**: `App.tsx` sets `currentStatus` to `AppStatus.Processing`.
3.  **Loop Execution** (for the specified number of iterations or until a stop condition):
    *   **A. Writer Phase**:
        1.  `App.tsx` constructs the writer's user prompt.
            *   For the very first iteration: Uses `initialWriterPrompt` and asks for N drafts.
            *   For subsequent iterations: Uses `initialWriterPrompt`, the content of the previously selected draft (as context), and the `consolidatedFeedbackForNextIteration` from the previous review (or `editableReviewComments` if manually continued). Asks for N drafts.
        2.  `App.tsx` calls `geminiService.generateContent` with:
            *   Model: `GEMINI_MODEL_TEXT`.
            *   Contents: Background material parts + constructed writer user prompt text part.
            *   Config: Writer system prompt and `writerSchema` for JSON output.
        3.  `geminiService.ts` makes the API call.
        4.  `geminiService.ts` receives the response, parses it using `parseWriterResponse`, and returns the `WriterMultiDraftOutput` object and `usageMetadata`.
        5.  `App.tsx` updates `currentMultiWriterOutput`, `totalInputTokensUsed`, `totalOutputTokensUsed`, and status message.
        6.  If parsing fails or an API error occurs, an error is thrown, caught by `App.tsx`, and `currentStatus` is set to `AppStatus.Error`.
    *   **B. Reviewer Phase**:
        1.  `App.tsx` constructs the reviewer's user prompt. This includes `reviewerCriteria` and the `documentContent` of all drafts generated by the writer in the current step.
        2.  `App.tsx` calls `geminiService.generateContent` with:
            *   Model: `GEMINI_MODEL_TEXT`.
            *   Contents: Background material parts + constructed reviewer user prompt text part.
            *   Config: Reviewer system prompt and `reviewerSchema` for JSON output.
        3.  `geminiService.ts` makes the API call.
        4.  `geminiService.ts` receives the response, parses it using `parseReviewerResponse`, and returns the `ReviewerMultiReviewResponse` object and `usageMetadata`.
        5.  `App.tsx` updates `currentReview`, `totalInputTokensUsed`, `totalOutputTokensUsed`, and status message.
        6.  If parsing fails or an API error occurs, an error is thrown.
    *   **C. Record Iteration**:
        1.  `App.tsx` creates a new `IterationStep` object containing all data from the current writer and reviewer phases.
        2.  This step is added to the `iterationSteps` array in the state.
    *   **D. Check Stop Conditions** (if not a manual continuation run for a fixed number of iterations):
        1.  `currentScore` is determined from the `selectedDraftIndex` in `currentReview`.
        2.  If `currentScore >= targetScore` AND `currentIterationNumber >= minIterations`:
            *   Set `currentStatus` to `AppStatus.Paused`.
            *   Stop the loop.
        3.  Else if `currentIterationNumber >= maxIterations`:
            *   Set `currentStatus` to `AppStatus.Paused`.
            *   Stop the loop.
4.  **Loop Completion**: If the loop finishes (either by completing all iterations in a manual run or by automatic stop conditions):
    *   `App.tsx` sets `currentStatus` to `AppStatus.Paused`.
    *   A final status message is displayed.

### 6.3. Paused State & Manual Continuation
1.  When `currentStatus` is `AppStatus.Paused`:
    *   The user can review all `iterationSteps` via `IterationDisplay.tsx`.
    *   The "Edit Consolidate Review Feedback" textarea becomes active, pre-filled with `consolidatedFeedbackForNextIteration` from the last review. User can modify this text (`editableReviewComments`).
    *   User can input a number of additional iterations for manual continuation.
    *   User can click "Manual Continue".
2.  "Manual Continue" triggers `handleManualContinue()` in `App.tsx`:
    *   It calls `runIterations()` again, passing `isManualContinuation = true`, the number of iterations to run, and the (potentially edited) `editableReviewComments` as an override for the reviewer feedback.
    *   The loop from 6.2 continues.
    *   The "Download Selected Document" button is active.

### 6.4. Error Handling
*   API errors from `geminiService.generateContent` (network, invalid key, quota, schema validation) are caught by `geminiService` and re-thrown as more user-friendly `Error` objects.
*   These errors are caught in the main processing functions (`runIterations`, `startIterativeProcess`, `handleManualContinue`) within `App.tsx`.
*   `App.tsx` sets `currentStatus` to `AppStatus.Error`, updates `errorMessage` state, and displays the error to the user.
*   JSON parsing errors in `geminiService` (e.g., `parseWriterResponse`, `parseReviewerResponse`) also result in `null` returns or thrown errors, handled similarly by `App.tsx`.

### 6.5. Token Counting
*   `geminiService.generateContent` returns `usageMetadata` (including `promptTokenCount` and `totalTokenCount`) from the Gemini API response.
*   `outputTokenCount` is calculated as `totalTokenCount - promptTokenCount`.
*   `App.tsx` accumulates these counts in `totalInputTokensUsed` and `totalOutputTokensUsed` state variables after each successful writer and reviewer API call.
*   These totals are displayed in the UI.

## 7. Styling and UI/UX Principles

*   **Styling**: Primarily achieved using [Tailwind CSS](https://tailwindcss.com/) for a utility-first approach, allowing for rapid development and consistent design. Custom styles are minimal and typically for global settings (like fonts in `index.html`) or complex component states.
*   **Responsiveness**: The application is designed to be responsive, adapting to different screen sizes from mobile to desktop, leveraging Tailwind's responsive prefixes.
*   **User Feedback**:
    *   Clear status messages are provided throughout the process.
    *   Loading states are indicated using the `LoadingSpinner` component and disabling interactive elements.
    *   Error messages are prominently displayed.
    *   Success feedback (e.g., file upload) is also provided.
*   **Information Hierarchy**: The UI is structured to guide the user through configuration, execution, and review of iterations. Key information like scores, selected drafts, and consolidated feedback is highlighted.
*   **Accessibility**: Standard HTML semantics are used. ARIA attributes (e.g., `aria-label`, `aria-describedby`) are used where appropriate to improve accessibility, though further review would be beneficial for comprehensive coverage.
*   **Aesthetics**: A dark theme is used with sky blue accents for a modern, focused appearance. Readability is prioritized with clear typography and sufficient contrast. Custom scrollbars are used for a more integrated look.

## 8. Future Considerations

*   **Streaming Responses**: Implement streaming for writer/reviewer responses to provide faster perceived feedback, especially for longer generations.
*   **Advanced Error Recovery**: More granular error handling, potentially allowing users to retry a specific failed step or edit a malformed AI response.
*   **Chat History Integration**: For multi-turn conversations within an iteration, if the Gemini API supports it more directly in this context or if the prompt engineering is adapted. (Current implementation is stateless per `generateContent` call but simulates history through prompt construction).
*   **More Sophisticated Reviewer Configuration**: Allow users to define multiple weighted criteria for the reviewer AI.
*   **Version Control/Diffing**: Show differences between drafts or iterations.
*   **Export/Import Iteration History**: Allow users to save and load their work.
*   **Cost Estimation**: Provide an estimated cost based on token usage.
*   **Batch Processing**: Allow users to run the iterative process on multiple input documents or prompt variations.
*   **User Authentication & Storage**: To save user preferences and project data.
*   **More Model Choices**: Allow users to select different Gemini models if applicable.
*   **Enhanced File Support**: More robust handling for various file types and larger files.