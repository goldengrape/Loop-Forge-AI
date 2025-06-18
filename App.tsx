
import React, { useState, useCallback, useEffect } from 'react';
import { Part } from '@google/genai';
import { FileUpload } from './components/FileUpload';
import { PromptInput } from './components/PromptInput';
import { IterationDisplay } from './components/IterationDisplay';
import { Button } from './components/Button';
import { LoadingSpinner } from './components/LoadingSpinner';
import { generateContent, parseReviewerResponse, parseWriterResponse, Type } from './services/geminiService';
import { IterationStep, AppStatus, WriterMultiDraftOutput, UploadedFilePart, ReviewerMultiReviewResponse } from './types';
import { DEFAULT_GEMINI_MODEL_TEXT, DEFAULT_MIN_ITERATIONS, DEFAULT_MAX_ITERATIONS, DEFAULT_TARGET_SCORE, DEFAULT_NUMBER_OF_DRAFTS } from './constants';

const writerDraftSchema = {
  type: Type.OBJECT,
  properties: {
    documentContent: { type: Type.STRING, description: "The full text of this specific document or code draft." },
    revisionSummary: { type: Type.STRING, description: "A summary of the changes made in this specific draft. If first draft, state 'Generated based on initial prompt for this draft variant.'." },
  },
  required: ['documentContent', 'revisionSummary']
};

const writerSchema = {
  type: Type.OBJECT,
  properties: {
    overallResponseToReview: { type: Type.STRING, description: "Detailed response to the consolidated feedback from the previous reviewer. If first iteration (generating initial drafts), state 'Initial draft generation attempt.'." },
    drafts: {
      type: Type.ARRAY,
      description: "An array containing N distinct document drafts as per user request.",
      items: writerDraftSchema
    },
  },
  required: ['overallResponseToReview', 'drafts']
};

const singleDraftReviewSchema = {
    type: Type.OBJECT,
    properties: {
        reviewText: { type: Type.STRING, description: "Comprehensive review comments for this specific draft." },
        score: { type: Type.NUMBER, description: "A numerical score from 0 to 100 for this draft." },
    },
    required: ['reviewText', 'score']
};

const reviewerSchema = {
  type: Type.OBJECT,
  properties: {
    draftReviews: {
        type: Type.ARRAY,
        description: "An array of review objects, one for each draft provided by the writer.",
        items: singleDraftReviewSchema
    },
    selectedDraftIndex: { type: Type.NUMBER, description: "The 0-based index of the draft you consider the best from the writer's provided drafts array." },
    consolidatedFeedbackForNextIteration: { type: Type.STRING, description: "Key overall feedback, reasons for selection, and actionable suggestions to guide the writer for the next revision cycle, focusing on improving the selected draft." },
  },
  required: ['draftReviews', 'selectedDraftIndex', 'consolidatedFeedbackForNextIteration']
};


const App = (): JSX.Element => {
  const [backgroundMaterial, setBackgroundMaterial] = useState<UploadedFilePart[]>([]);
  const [initialWriterPrompt, setInitialWriterPrompt] = useState<string>("请根据背景资料撰写一份[文档类型]。");
  const [reviewerCriteria, setReviewerCriteria] = useState<string>("请审查以下内容，关注[审查方面]，并给出0-100分的评分。");

  const [modelNameInput, setModelNameInput] = useState<string>(DEFAULT_GEMINI_MODEL_TEXT);
  const [minIterationsInput, setMinIterationsInput] = useState<string>(String(DEFAULT_MIN_ITERATIONS));
  const [maxIterationsInput, setMaxIterationsInput] = useState<string>(String(DEFAULT_MAX_ITERATIONS));
  const [targetScoreInput, setTargetScoreInput] = useState<string>(String(DEFAULT_TARGET_SCORE));
  const [numberOfDraftsInput, setNumberOfDraftsInput] = useState<string>(String(DEFAULT_NUMBER_OF_DRAFTS));


  const [iterationSteps, setIterationSteps] = useState<IterationStep[]>([]);
  const [currentStatus, setCurrentStatus] = useState<AppStatus>(AppStatus.Idle);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [currentMultiWriterOutput, setCurrentMultiWriterOutput] = useState<WriterMultiDraftOutput | null>(null);
  const [currentReview, setCurrentReview] = useState<ReviewerMultiReviewResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isReviewEditable, setIsReviewEditable] = useState<boolean>(false);
  const [editableReviewComments, setEditableReviewComments] = useState<string>("");
  const [manualContinueCountInput, setManualContinueCountInput] = useState<string>("1");

  const [totalInputTokensUsed, setTotalInputTokensUsed] = useState<number>(0);
  const [totalOutputTokensUsed, setTotalOutputTokensUsed] = useState<number>(0);

  const [pastedText, setPastedText] = useState<string>("");
  const [pastedTextFeedback, setPastedTextFeedback] = useState<string>('');
  const [pastedTextFeedbackType, setPastedTextFeedbackType] = useState<'success' | 'error' | 'info'>('info');


  const commonWriterSystemPrompt = `你是一位专业的撰写者。你的任务是根据用户提供的背景资料、撰写要求以及可能的审查意见来生成或修订内容。
你必须严格按照提供的JSON Schema返回你的输出。
JSON对象必须包含 "overallResponseToReview" (字符串) 和 "drafts" (数组) 字段。
- "overallResponseToReview": 对上一轮审查者提供的 "consolidatedFeedbackForNextIteration" 的逐条回应。如果是初稿，则此字段应为 "初稿生成尝试。" 或类似描述。
- "drafts": 一个包含用户要求的N个独立文档草稿的数组。每个草稿对象必须包含 "documentContent" (字符串，实际生成的文档或代码内容) 和 "revisionSummary" (字符串，总结本次修订中该草稿的主要内容和原因；如果是初稿，则为 "基于初始要求生成此草案变体。" 或类似描述)。
请确保为每个草稿提供独特的 "documentContent" 和相应的 "revisionSummary"。`;

  const commonReviewerSystemPrompt = `你是一位严格的审查AI。根据用户提供的背景资料、审查标准以及撰写者生成的N份草稿内容进行审查。
请提供详细的审查意见，并为每份草稿给出0到100分的评分（100分最高）。
然后，选出你认为最优的一份草稿，并提供一份整合的审查意见，用于指导撰写者下一轮的修订。
你的回答必须严格按照提供的JSON Schema格式。
JSON对象必须包含 "draftReviews" (数组), "selectedDraftIndex" (数字), 和 "consolidatedFeedbackForNextIteration" (字符串) 字段。
- "draftReviews": 一个包含N个审查对象的数组，每个对象对应一份草稿，并包含 "reviewText" (对此草稿的详细审查意见) 和 "score" (为此草稿打分0-100)。
- "selectedDraftIndex": 你选出的最优草稿在原始草稿数组中的0基索引。
- "consolidatedFeedbackForNextIteration": 对所有草稿的综合性关键反馈，解释选择该草稿的原因，并为撰写者提供在选定草稿基础上进行下一轮迭代的具体指导。`;


  useEffect(() => {
    if (currentStatus === AppStatus.Paused && iterationSteps.length > 0) {
      const lastStep = iterationSteps[iterationSteps.length - 1];
      if (lastStep.review) {
        setEditableReviewComments(lastStep.review.consolidatedFeedbackForNextIteration);
        setIsReviewEditable(true);
      }
    } else {
      setIsReviewEditable(false);
    }
  }, [currentStatus, iterationSteps]);

  const handleFileUpload = useCallback((uploadedFileParts: UploadedFilePart[]) => {
    setBackgroundMaterial(prev => [...prev, ...uploadedFileParts]);
    setErrorMessage(null); // Clear general errors when a file operation succeeds
  }, []);

  const handleRemoveFile = useCallback((fileIdToRemove: string) => {
    setBackgroundMaterial(prev => prev.filter(filePart => filePart.id !== fileIdToRemove));
  }, []);

  const handleAddPastedText = useCallback(() => {
    if (!pastedText.trim()) {
      setPastedTextFeedback('请输入文本内容后再添加。');
      setPastedTextFeedbackType('error');
      return;
    }
    const newTextFilePart: UploadedFilePart = {
      id: `pasted-text-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: `粘贴文本 ${backgroundMaterial.filter(m => m.id.startsWith('pasted-text-')).length + 1}`,
      part: { text: pastedText.trim() },
    };
    handleFileUpload([newTextFilePart]); // Leverage existing logic
    setPastedText('');
    setPastedTextFeedback(`"${newTextFilePart.name}" 已添加为背景资料。`);
    setPastedTextFeedbackType('success');
  }, [pastedText, backgroundMaterial, handleFileUpload]);


  const resetState = () => {
    setBackgroundMaterial([]);
    setInitialWriterPrompt("请根据背景资料撰写一份[文档类型]。");
    setReviewerCriteria("请审查以下内容，关注[审查方面]，并给出0-100分的评分。");
    setModelNameInput(DEFAULT_GEMINI_MODEL_TEXT);
    setMinIterationsInput(String(DEFAULT_MIN_ITERATIONS));
    setMaxIterationsInput(String(DEFAULT_MAX_ITERATIONS));
    setTargetScoreInput(String(DEFAULT_TARGET_SCORE));
    setNumberOfDraftsInput(String(DEFAULT_NUMBER_OF_DRAFTS));
    setIterationSteps([]);
    setCurrentStatus(AppStatus.Idle);
    setStatusMessage("");
    setCurrentMultiWriterOutput(null);
    setCurrentReview(null);
    setErrorMessage(null);
    setIsReviewEditable(false);
    setEditableReviewComments("");
    setManualContinueCountInput("1");
    setTotalInputTokensUsed(0);
    setTotalOutputTokensUsed(0);
    setPastedText("");
    setPastedTextFeedback("");
    setPastedTextFeedbackType("info");
  };

  const validateInputs = () => {
    const minIter = parseInt(minIterationsInput, 10);
    const maxIter = parseInt(maxIterationsInput, 10);
    const targetScoreNum = parseInt(targetScoreInput, 10);
    const numDrafts = parseInt(numberOfDraftsInput, 10);
    const modelName = modelNameInput.trim();

    if (!modelName) {
      setErrorMessage("请输入模型名称。");
      return false;
    }
    if (isNaN(minIter) || minIter < 1) {
      setErrorMessage("最小迭代次数必须是大于或等于1的数字。");
      return false;
    }
    if (isNaN(maxIter) || maxIter < minIter) {
      setErrorMessage("最大迭代次数必须是数字，且不能小于最小迭代次数。");
      return false;
    }
    if (isNaN(targetScoreNum) || targetScoreNum < 0 || targetScoreNum > 100) {
      setErrorMessage("目标评分必须是0到100之间的数字。");
      return false;
    }
    if (isNaN(numDrafts) || numDrafts < 1 || numDrafts > 3) {
      setErrorMessage("每次迭代的草稿数量必须是1到3之间的数字。");
      return false;
    }
    if (!initialWriterPrompt.trim()) {
      setErrorMessage("请输入撰写者要求。");
      return false;
    }
    if (!reviewerCriteria.trim()) {
      setErrorMessage("请输入审查者要求。");
      return false;
    }
    return { minIter, maxIter, targetScoreNum, numDrafts, modelName };
  };

  const runIterations = useCallback(async (
    startingIterationNumber: number,
    numberOfIterationsToDo: number,
    isManualContinuation: boolean,
    manualReviewOverride?: string
  ) => {
    const validationResult = validateInputs();
    if (!validationResult) {
      setCurrentStatus(AppStatus.Idle);
      return;
    }
    const { minIter, maxIter, targetScoreNum, numDrafts, modelName } = validationResult;

    let iterationWriterOutput: WriterMultiDraftOutput | null = currentMultiWriterOutput;
    let iterationReviewOutput: ReviewerMultiReviewResponse | null = currentReview;

    let currentScore = 0;
    if (iterationReviewOutput && iterationReviewOutput.draftReviews.length > iterationReviewOutput.selectedDraftIndex) {
        currentScore = iterationReviewOutput.draftReviews[iterationReviewOutput.selectedDraftIndex]?.score || 0;
    }


    const newIterationStepsBatch: IterationStep[] = [];
    setCurrentStatus(AppStatus.Processing);
    setErrorMessage(null);
    setPastedTextFeedback(''); // Clear paste text feedback during processing

    const activeBackgroundParts = backgroundMaterial.map(bfp => bfp.part);

    for (let i = 0; i < numberOfIterationsToDo; i++) {
      const overallIterationNumber = startingIterationNumber + i;
      let stepWriterInputTokens = 0;
      let stepWriterOutputTokens = 0;
      let stepReviewerInputTokens = 0;
      let stepReviewerOutputTokens = 0;

      setStatusMessage(`第 ${overallIterationNumber}轮 (目标: ${isManualContinuation ? '手动继续' : maxIter}轮) - 撰写者生成 ${numDrafts} 份草稿...`);

      const writerUserParts: Part[] = [...activeBackgroundParts];
      let writerInstructionForUser: string;
      const previousStep = iterationSteps.length > 0 ? iterationSteps[iterationSteps.length -1] : (newIterationStepsBatch.length > 0 ? newIterationStepsBatch[newIterationStepsBatch.length -1] : null);


      if (overallIterationNumber === 1 && !iterationWriterOutput) { 
        writerInstructionForUser = `初始撰写要求:\n${initialWriterPrompt}\n\n请生成 ${numDrafts} 份独立的草稿。严格按照JSON Schema返回输出。`;
      } else { 
        let feedbackForWriter = previousStep?.review?.consolidatedFeedbackForNextIteration || "无先前审查反馈。";
        let baseDocumentContent = "无先前选定文档内容。";

        if (previousStep?.writerOutput && previousStep?.review && previousStep.review.selectedDraftIndex >= 0 && previousStep.review.selectedDraftIndex < previousStep.writerOutput.drafts.length) {
            baseDocumentContent = previousStep.writerOutput.drafts[previousStep.review.selectedDraftIndex].documentContent;
        }

        if (isManualContinuation && i === 0 && manualReviewOverride) {
            feedbackForWriter = manualReviewOverride; 
        }
        writerInstructionForUser = `原始撰写要求: ${initialWriterPrompt}\n先前选定草稿的内容提示 (部分，仅供参考，主要依据整合审查意见):\n${baseDocumentContent.substring(0, 300)}...\n\n整合审查意见 (或用户修改/确认的审查意见):\n${feedbackForWriter}\n\n请根据以上信息和审查意见，在选定草稿的基础上进行修改，并生成 ${numDrafts} 份独立的草稿。严格按照JSON Schema返回输出。`;
      }
      writerUserParts.push({ text: writerInstructionForUser });

      const writerResponse = await generateContent(
        modelName,
        writerUserParts,
        { systemInstruction: commonWriterSystemPrompt, responseSchema: writerSchema }
      );

      stepWriterInputTokens = writerResponse.usageMetadata?.promptTokenCount || 0;
      const writerTotalTokens = writerResponse.usageMetadata?.totalTokenCount || 0;
      stepWriterOutputTokens = (writerTotalTokens > 0 && stepWriterInputTokens >= 0 && writerTotalTokens >= stepWriterInputTokens) ? (writerTotalTokens - stepWriterInputTokens) : 0;
      
      setTotalInputTokensUsed(prev => prev + stepWriterInputTokens);
      setTotalOutputTokensUsed(prev => prev + stepWriterOutputTokens);

      const parsedWriterOutput = parseWriterResponse(writerResponse.text);
      if (!parsedWriterOutput || parsedWriterOutput.drafts.length !== numDrafts) {
        throw new Error(`撰写者返回的JSON格式无效，或草稿数量 (${parsedWriterOutput?.drafts?.length}) 与要求的 (${numDrafts}) 不符。请检查撰写者提示词和API响应。原始回复: ${writerResponse.text}`);
      }
      iterationWriterOutput = parsedWriterOutput;
      setCurrentMultiWriterOutput(iterationWriterOutput);

      setStatusMessage(`第 ${overallIterationNumber}轮 - 撰写完成 ${numDrafts} 份草稿，审查者审查中...`);

      const reviewerUserPartsText = `审查标准:\n${reviewerCriteria}\n\n待审查的 ${numDrafts} 份草稿内容如下:\n` +
        iterationWriterOutput.drafts.map((draft, index) => `--- 草稿 ${index + 1} ---\n${draft.documentContent}\n--- END 草稿 ${index + 1} ---`).join('\n\n');
      
      const reviewerResponse = await generateContent(
        modelName,
        [...activeBackgroundParts, { text: reviewerUserPartsText }],
        { systemInstruction: commonReviewerSystemPrompt, responseSchema: reviewerSchema }
      );

      stepReviewerInputTokens = reviewerResponse.usageMetadata?.promptTokenCount || 0;
      const reviewerTotalTokens = reviewerResponse.usageMetadata?.totalTokenCount || 0;
      stepReviewerOutputTokens = (reviewerTotalTokens > 0 && stepReviewerInputTokens >= 0 && reviewerTotalTokens >= stepReviewerInputTokens) ? (reviewerTotalTokens - stepReviewerInputTokens) : 0;

      setTotalInputTokensUsed(prev => prev + stepReviewerInputTokens);
      setTotalOutputTokensUsed(prev => prev + stepReviewerOutputTokens);

      const reviewData = parseReviewerResponse(reviewerResponse.text);
      if (!reviewData || reviewData.draftReviews.length !== numDrafts) {
        throw new Error(`审查者返回的JSON格式无效，或审查数量 (${reviewData?.draftReviews?.length}) 与草稿数量 (${numDrafts}) 不符。请检查审查者提示词和API响应。原始回复: ${reviewerResponse.text}`);
      }
      iterationReviewOutput = reviewData;
      setCurrentReview(iterationReviewOutput);
      
      if (reviewData.selectedDraftIndex >= 0 && reviewData.selectedDraftIndex < reviewData.draftReviews.length) {
        currentScore = reviewData.draftReviews[reviewData.selectedDraftIndex].score;
      } else {
        console.warn("Reviewer selected an invalid draft index. Defaulting score to 0.", reviewData);
        currentScore = 0; 
      }

      const step: IterationStep = {
        id: overallIterationNumber,
        writerInstructionLog: writerInstructionForUser,
        writerOutput: iterationWriterOutput,
        writerInputTokens: stepWriterInputTokens,
        writerOutputTokens: stepWriterOutputTokens,
        review: iterationReviewOutput, 
      };
      newIterationStepsBatch.push(step);
      setIterationSteps(prev => [...prev, step]);

      if (!isManualContinuation) {
        if (currentScore >= targetScoreNum && overallIterationNumber >= minIter) {
          setStatusMessage(`已达到目标评分 ${targetScoreNum} (当前选定草稿评分: ${currentScore}) 且已完成最少 ${minIter} 轮。流程暂停。`);
          setCurrentStatus(AppStatus.Paused);
          return;
        }
        if (overallIterationNumber >= maxIter) {
          setStatusMessage(`已达到最大迭代次数 ${maxIter}。流程暂停。最终选定草稿评分: ${currentScore}`);
          setCurrentStatus(AppStatus.Paused);
          return;
        }
      }
    } 

    const finalSelectedDraftScore = iterationReviewOutput?.draftReviews[iterationReviewOutput.selectedDraftIndex]?.score || 0;
    setStatusMessage(`已完成指定 ${isManualContinuation ? numberOfIterationsToDo : '所有'}轮迭代。流程暂停。最终选定草稿评分: ${finalSelectedDraftScore}`);
    setCurrentStatus(AppStatus.Paused);

  }, [
    backgroundMaterial, initialWriterPrompt, reviewerCriteria, modelNameInput,
    iterationSteps, minIterationsInput, maxIterationsInput, targetScoreInput, numberOfDraftsInput,
    commonWriterSystemPrompt, commonReviewerSystemPrompt, currentMultiWriterOutput, currentReview, validateInputs
  ]);


  const startIterativeProcess = useCallback(async () => {
    const validationResult = validateInputs();
    if (!validationResult) return;
    const { maxIter } = validationResult;

    setIterationSteps([]);
    setCurrentMultiWriterOutput(null);
    setCurrentReview(null);
    setTotalInputTokensUsed(0);
    setTotalOutputTokensUsed(0);
    try {
      await runIterations(1, maxIter, false);
    } catch (error: any) {
      console.error("处理过程中发生错误:", error);
      setErrorMessage(`错误: ${error.message || '发生未知错误'}`);
      setCurrentStatus(AppStatus.Error);
      setStatusMessage("处理失败。");
    }
  }, [validateInputs, runIterations, modelNameInput]);

  const handleManualContinue = useCallback(async () => {
    const count = parseInt(manualContinueCountInput, 10);
    if (isNaN(count) || count < 1) {
      setErrorMessage("手动继续的轮次必须是大于或等于1的数字。");
      return;
    }
    if (!currentMultiWriterOutput || !currentReview) {
      setErrorMessage("没有可供继续的先前迭代结果。");
      return;
    }
     if (!editableReviewComments.trim()) {
      setErrorMessage("整合审查意见不能为空。");
      return;
    }

    setErrorMessage(null);
    setIsReviewEditable(false);

    const startingIterNum = iterationSteps.length > 0 ? iterationSteps[iterationSteps.length -1].id + 1 : 1;

    try {
      await runIterations(startingIterNum, count, true, editableReviewComments);
    } catch (e: any) { 
      console.error("手动继续过程中发生错误:", e); 
      setErrorMessage(`错误: ${e.message || '发生未知错误'}`); 
      setCurrentStatus(AppStatus.Error);
      setStatusMessage("手动处理失败。");
    }
  }, [manualContinueCountInput, currentMultiWriterOutput, currentReview, editableReviewComments, iterationSteps, runIterations]);


  const downloadFinalDocument = () => {
    if (!currentMultiWriterOutput || !currentReview || currentReview.selectedDraftIndex < 0 || currentReview.selectedDraftIndex >= currentMultiWriterOutput.drafts.length) {
        setErrorMessage("没有有效的最终选定文档内容可供下载。");
        return;
    }
    const selectedDocumentContent = currentMultiWriterOutput.drafts[currentReview.selectedDraftIndex].documentContent;
    const element = document.createElement("a");
    const file = new Blob([selectedDocumentContent], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = "final_selected_document.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const isProcessing = currentStatus === AppStatus.Processing;
  const canStartProcess = currentStatus === AppStatus.Idle || currentStatus === AppStatus.Error || currentStatus === AppStatus.Paused;
  const inputStyleClasses = "block w-full p-3 rounded-lg border border-slate-600 bg-slate-700/50 shadow-sm text-slate-100 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 disabled:opacity-60 transition-colors";


  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 sm:p-6 lg:p-8 flex flex-col">
      <header className="text-center mb-10">
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300 py-2">
          Loop Forge迭代优化
        </h1>
        <p className="text-slate-400 mt-3 text-lg">通过AI驱动的迭代优化您的文档和代码，具有结构化输出和双栏视图。</p>
      </header>

      <section aria-labelledby="config-and-controls-heading" className="mb-10">
        <h2 id="config-and-controls-heading" className="sr-only">配置与控制</h2>
        <div className="space-y-8">

          {/* Input Materials & Prompts Section */}
          <div className="space-y-6">
            <div className="bg-slate-800/70 p-6 rounded-xl shadow-2xl backdrop-blur-sm border border-slate-700/50 hover:border-slate-600 transition-all">
              <h3 className="text-xl font-semibold text-sky-300 mb-5 border-b border-slate-700 pb-3">输入资料与要求</h3>
              
              <FileUpload 
                onFileUploaded={handleFileUpload} 
                disabled={isProcessing || (currentStatus === AppStatus.Paused && !isReviewEditable)} 
              />

              <div className="mt-6 pt-6 border-t border-slate-700/50">
                <label htmlFor="pasted-text-input" className="block text-sm font-medium text-slate-300 mb-2">
                  或粘贴背景文本 (Or Paste Background Text)
                </label>
                <textarea
                  id="pasted-text-input"
                  rows={5}
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value);
                    if (pastedTextFeedback) setPastedTextFeedback(''); 
                  }}
                  disabled={isProcessing || (currentStatus === AppStatus.Paused && !isReviewEditable)}
                  className={`${inputStyleClasses} scrollbar-thin`}
                  placeholder="在此处粘贴文本内容..."
                  aria-label="粘贴背景文本区域"
                />
                <Button
                  onClick={handleAddPastedText}
                  disabled={isProcessing || !pastedText.trim() || (currentStatus === AppStatus.Paused && !isReviewEditable)}
                  className="mt-3 w-full sm:w-auto px-5 py-2.5"
                  variant="secondary"
                >
                  添加粘贴文本为背景资料
                </Button>
                {pastedTextFeedback && <p id="pasted-text-feedback" className={`mt-2.5 text-sm ${pastedTextFeedbackType === 'success' ? 'text-green-400' : pastedTextFeedbackType === 'error' ? 'text-red-400' : 'text-slate-400'}`}>{pastedTextFeedback}</p>}
              </div>

              {backgroundMaterial.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-700/50">
                  <h4 className="text-base font-medium text-slate-300 mb-3">已添加背景资料:</h4>
                  <ul className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin pr-1">
                    {backgroundMaterial.map((file) => (
                      <li key={file.id} className="flex justify-between items-center text-sm text-slate-300 bg-slate-600/70 p-2.5 rounded-md hover:bg-slate-600 transition-colors">
                        <div className="flex items-center truncate">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2 text-sky-400 flex-shrink-0">
                            <path fillRule="evenodd" d="M15.986 4.014H4.014A1.014 1.014 0 0 0 3 5.028v9.944A1.014 1.014 0 0 0 4.014 16h11.972A1.014 1.014 0 0 0 17 14.972V5.028A1.014 1.014 0 0 0 15.986 4.014Zm-3.08 4.56a.75.75 0 0 0-1.06 1.06L13.06 11H7a.75.75 0 0 0 0 1.5h6.06l-1.215 1.215a.75.75 0 1 0 1.06 1.06l2.5-2.5a.75.75 0 0 0 0-1.06l-2.5-2.5Z" clipRule="evenodd" />
                          </svg>
                          <span title={file.name} className="truncate">
                            {file.name.length > 35 ? `${file.name.substring(0,32)}...` : file.name}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveFile(file.id)}
                          className="p-1 rounded-full text-red-400 hover:text-red-300 hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition-colors"
                          aria-label={`移除 ${file.name}`}
                          disabled={isProcessing || (currentStatus === AppStatus.Paused && !isReviewEditable)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className={`mt-5 ${backgroundMaterial.length > 0 ? 'pt-6 border-t border-slate-700/50' : 'pt-0'}`}>
                <PromptInput
                  id="writer-prompt"
                  label="初始撰写者要求 (Writer Prompt)"
                  value={initialWriterPrompt}
                  onChange={(e) => setInitialWriterPrompt(e.target.value)}
                  disabled={isProcessing || (currentStatus === AppStatus.Paused && !isReviewEditable)}
                  placeholder="例如：根据背景资料，生成一份关于AI伦理的报告草案。"
                />
              </div>
              <div>
                <PromptInput
                  id="reviewer-criteria"
                  label="审查者要求 (Reviewer Criteria)"
                  value={reviewerCriteria}
                  onChange={(e) => setReviewerCriteria(e.target.value)}
                  disabled={isProcessing || (currentStatus === AppStatus.Paused && !isReviewEditable)}
                  placeholder="例如：检查报告的逻辑连贯性、论据充分性。"
                />
              </div>
            </div>
          </div>

          {/* Iteration Parameters Card */}
          <div className="bg-slate-800/70 p-6 rounded-xl shadow-2xl backdrop-blur-sm border border-slate-700/50 hover:border-slate-600 transition-all">
            <h3 className="text-xl font-semibold text-sky-300 mb-5 border-b border-slate-700 pb-3">迭代参数</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 items-end">
              <div>
                <label htmlFor="model-name" className="block text-sm font-medium text-slate-300 mb-1.5">模型名称 (Model Name)</label>
                <input 
                  type="text" 
                  id="model-name" 
                  value={modelNameInput} 
                  onChange={e => setModelNameInput(e.target.value)} 
                  disabled={isProcessing || (currentStatus === AppStatus.Paused && !isReviewEditable)} 
                  className={inputStyleClasses}
                  placeholder={`例如 ${DEFAULT_GEMINI_MODEL_TEXT}`}
                />
              </div>
              <div>
                <label htmlFor="num-drafts" className="block text-sm font-medium text-slate-300 mb-1.5">每次迭代草稿数量 (1-3)</label>
                <input type="number" id="num-drafts" value={numberOfDraftsInput} onChange={e => setNumberOfDraftsInput(e.target.value)} min="1" max="3" disabled={isProcessing || (currentStatus === AppStatus.Paused && !isReviewEditable)} className={inputStyleClasses} />
              </div>
              <div>
                <label htmlFor="min-iterations" className="block text-sm font-medium text-slate-300 mb-1.5">最小迭代次数</label>
                <input type="number" id="min-iterations" value={minIterationsInput} onChange={e => setMinIterationsInput(e.target.value)} min="1" disabled={isProcessing || (currentStatus === AppStatus.Paused && !isReviewEditable)} className={inputStyleClasses} />
              </div>
              <div>
                <label htmlFor="max-iterations" className="block text-sm font-medium text-slate-300 mb-1.5">最大迭代次数</label>
                <input type="number" id="max-iterations" value={maxIterationsInput} onChange={e => setMaxIterationsInput(e.target.value)} min="1" disabled={isProcessing || (currentStatus === AppStatus.Paused && !isReviewEditable)} className={inputStyleClasses} />
              </div>
              <div>
                <label htmlFor="target-score" className="block text-sm font-medium text-slate-300 mb-1.5">目标评分 (0-100)</label>
                <input type="number" id="target-score" value={targetScoreInput} onChange={e => setTargetScoreInput(e.target.value)} min="0" max="100" disabled={isProcessing || (currentStatus === AppStatus.Paused && !isReviewEditable)} className={inputStyleClasses} />
              </div>
            </div>
          </div>

          {/* Controls & Status Card */}
          <div className="bg-slate-800/70 p-6 rounded-xl shadow-2xl backdrop-blur-sm border border-slate-700/50 hover:border-slate-600 transition-all">
            <h3 className="text-xl font-semibold text-sky-300 mb-5 border-b border-slate-700 pb-3">控制与状态</h3>
            <div className="space-y-4">
              {statusMessage && <p className={`mb-2 p-3 rounded-md text-sm ${errorMessage ? 'bg-red-800/70 text-red-100 border border-red-700' : 'bg-sky-800/70 text-sky-100 border border-sky-700'}`}>{statusMessage}</p>}
              {errorMessage && !statusMessage && <p className="mb-2 p-3 bg-red-800/70 text-red-100 rounded-md text-sm border border-red-700">{errorMessage}</p>}

              {(iterationSteps.length > 0 || isProcessing) && (
                <div className="p-3.5 bg-slate-700/60 rounded-lg text-slate-300 text-sm space-y-1.5 border border-slate-600/50">
                    <p>总输入 Token: <span className="font-semibold text-sky-300">{totalInputTokensUsed.toLocaleString()}</span></p>
                    <p>总输出 Token: <span className="font-semibold text-sky-300">{totalOutputTokensUsed.toLocaleString()}</span></p>
                </div>
              )}

              {canStartProcess && !isReviewEditable && (
                <Button
                  onClick={startIterativeProcess}
                  className="w-full text-lg py-3"
                  disabled={isProcessing}
                  variant="primary"
                >
                  {iterationSteps.length > 0 ? '重新开始迭代' : '开始迭代流程'}
                </Button>
              )}
               <Button onClick={resetState} className="w-full py-3" disabled={isProcessing} variant="secondary">
                 重置所有
               </Button>

              {isProcessing && (
                <div className="flex items-center justify-center w-full py-3 bg-slate-700/50 rounded-lg">
                  <LoadingSpinner />
                  <span className="ml-3 text-lg text-slate-300">处理中...</span>
                </div>
              )}
              {currentStatus === AppStatus.Paused && currentMultiWriterOutput && currentReview && (
                <Button onClick={downloadFinalDocument} className="w-full text-lg py-3" variant="success" disabled={isProcessing}>
                  下载选定文档
                </Button>
              )}
              {isReviewEditable && currentStatus === AppStatus.Paused && (
                <div className="mt-4 p-4 bg-slate-700/60 rounded-lg border border-slate-600/50">
                  <h4 className="text-md font-semibold text-sky-300 mb-3">编辑整合审查意见</h4>
                  <textarea
                    value={editableReviewComments}
                    onChange={(e) => setEditableReviewComments(e.target.value)}
                    rows={5}
                    className="block w-full rounded-lg border-slate-600 bg-slate-800/70 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 sm:text-sm p-3 text-slate-100 placeholder-slate-400 scrollbar-thin transition-colors"
                    disabled={isProcessing}
                    aria-label="可编辑的整合审查意见"
                  />
                  <div className="mt-4 flex items-center gap-3">
                    <label htmlFor="manual-continue-count" className="text-sm text-slate-300 whitespace-nowrap">继续轮次:</label>
                    <input
                      type="number"
                      id="manual-continue-count"
                      value={manualContinueCountInput}
                      onChange={(e) => setManualContinueCountInput(e.target.value)}
                      min="1"
                      className="block w-24 rounded-lg border-slate-600 bg-slate-800/70 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 sm:text-sm p-2.5 text-slate-100 transition-colors"
                      disabled={isProcessing}
                      aria-label="手动继续轮次数量"
                    />
                    <Button onClick={handleManualContinue} className="bg-orange-600 hover:bg-orange-700 flex-grow py-2.5" disabled={isProcessing}>
                      手动继续
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {iterationSteps.length > 0 && (
        <section aria-labelledby="iteration-history-heading" className="mt-4 flex-grow">
          <h2 id="iteration-history-heading" className="text-3xl font-bold text-sky-300 mb-8 text-center">迭代历史与结果</h2>
          <div className="space-y-10">
            {iterationSteps.map((step, index) => (
              <IterationDisplay
                key={step.id}
                step={step}
                isCurrentActiveStep={index === iterationSteps.length - 1 && (currentStatus === AppStatus.Paused || currentStatus === AppStatus.Processing)}
                targetScore={parseInt(targetScoreInput,10) || DEFAULT_TARGET_SCORE}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default App;
