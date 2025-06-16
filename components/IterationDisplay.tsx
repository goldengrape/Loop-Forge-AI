
import React, { useState, useEffect } from 'react';
import { IterationStep, WriterDraft, SingleDraftReview } from '../types';
import { Button } from './Button'; // Import Button for tab-like interface

interface IterationDisplayProps {
  step: IterationStep;
  isCurrentActiveStep: boolean;
  targetScore: number;
}

interface SectionTitleProps {
  title: string;
  inputTokens?: number;
  outputTokens?: number;
  className?: string;
}

const SectionTitle: React.FC<SectionTitleProps> = ({ title, inputTokens, outputTokens, className }) => (
  <div className={`flex justify-between items-baseline mb-1.5 pt-1 ${className}`}>
    <h5 className="text-base font-semibold text-sky-300">{title}</h5>
    {(typeof inputTokens === 'number' || typeof outputTokens === 'number') && (
      <span className="text-xs text-slate-400 font-medium">
        Tokens:
        {typeof inputTokens === 'number' && ` In ${inputTokens.toLocaleString()}`}
        {typeof inputTokens === 'number' && typeof outputTokens === 'number' && ' /'}
        {typeof outputTokens === 'number' && ` Out ${outputTokens.toLocaleString()}`}
      </span>
    )}
  </div>
);

const SectionContentDisplay: React.FC<{ content: string | undefined; maxHeight?: string; isPrompt?: boolean }> = ({ content, maxHeight = 'max-h-52', isPrompt = false }) => (
  <pre className={`text-sm ${isPrompt ? 'text-slate-400 bg-slate-700/40' : 'text-slate-200 bg-slate-700/60'} whitespace-pre-wrap p-3 rounded-md ${maxHeight} overflow-y-auto scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-slate-700/50 border border-slate-600/50`}>
    {content || (isPrompt ? "无特定指令提供。" : "无内容。")}
  </pre>
);

interface DraftAndReviewCardProps {
  draftNumber: number;
  writerDraft: WriterDraft;
  draftReview?: SingleDraftReview; // Review might not exist if writer failed or reviewer is processing
  isSelected: boolean;
  targetScore: number;
}

const DraftAndReviewCard: React.FC<DraftAndReviewCardProps> = ({ draftNumber, writerDraft, draftReview, isSelected, targetScore }) => {
  let scoreColor = 'text-slate-400';
  if (draftReview) {
    if (draftReview.score >= targetScore) scoreColor = 'text-green-400';
    else if (draftReview.score >= targetScore * 0.75) scoreColor = 'text-yellow-400';
    else scoreColor = 'text-red-400';
  }

  return (
    <div className={`p-4 rounded-lg ${isSelected ? 'bg-sky-900/50 border-sky-600 ring-2 ring-sky-500' : 'bg-slate-700/30 border-slate-600/80'} border`}>
      <div className="flex justify-between items-center mb-3">
        <h6 className={`text-md font-semibold ${isSelected ? 'text-sky-300' : 'text-slate-200'}`}>
          草稿 #{draftNumber} {isSelected && <span className="ml-2 text-xs font-normal py-0.5 px-2 rounded-full bg-sky-500 text-white">已选定</span>}
        </h6>
        {draftReview && (
          <p className={`text-md font-semibold ${scoreColor}`}>评分: {draftReview.score}/100</p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionTitle title="此草稿修订总结" className="text-sm !mb-1 !pt-0" />
          <SectionContentDisplay content={writerDraft.revisionSummary} maxHeight="max-h-28" />
          <SectionTitle title="此草稿内容" className="text-sm !mt-3 !mb-1 !pt-0" />
          <SectionContentDisplay content={writerDraft.documentContent} maxHeight="max-h-60" />
        </div>
        {draftReview ? (
          <div>
            <SectionTitle title="对此草稿的审查意见" className="text-sm !mb-1 !pt-0" />
            <SectionContentDisplay content={draftReview.reviewText} maxHeight="max-h-full" /> {/* Allow full height for review */}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic md:col-span-1 flex items-center justify-center">等待审查意见...</p>
        )}
      </div>
    </div>
  );
};


export const IterationDisplay: React.FC<IterationDisplayProps> = ({ step, isCurrentActiveStep, targetScore }) => {
  const [activeDraftTab, setActiveDraftTab] = useState(0);

  let overallScore = 0;
  let overallScoreColor = 'text-red-400'; // Default
  let overallBorderColor = 'border-slate-700/70';
  let overallShadow = 'shadow-xl';

  if (step.review && step.review.selectedDraftIndex >= 0 && step.review.draftReviews.length > step.review.selectedDraftIndex) {
    overallScore = step.review.draftReviews[step.review.selectedDraftIndex].score;
    if (overallScore >= targetScore) overallScoreColor = 'text-green-400';
    else if (overallScore >= targetScore * 0.75) overallScoreColor = 'text-yellow-400';
  }

  if (isCurrentActiveStep) {
    overallBorderColor = 'border-sky-500 shadow-sky-500/20';
    overallShadow = 'shadow-2xl ring-2 ring-sky-500 ring-opacity-60';
  } else if (step.review && overallScore >= targetScore) {
    overallBorderColor = 'border-green-600/60';
  }
  
  // Ensure activeDraftTab is valid if selectedDraftIndex is available
  useEffect(() => {
    if (step.review && step.review.selectedDraftIndex >= 0 && step.writerOutput && step.review.selectedDraftIndex < step.writerOutput.drafts.length) {
      setActiveDraftTab(step.review.selectedDraftIndex);
    } else {
      setActiveDraftTab(0); // Default to first tab if no selection or invalid
    }
  }, [step.review, step.writerOutput]);


  return (
    <article className={`p-5 rounded-xl bg-slate-800/80 border ${overallBorderColor} ${overallShadow} transition-all duration-300 ease-in-out backdrop-blur-sm`}>
      <header className="flex flex-col sm:flex-row justify-between sm:items-center mb-5 pb-3 border-b border-slate-700 gap-2">
        <h3 className="text-xl font-bold text-sky-400">迭代轮次 #{step.id}</h3>
        {step.review && (
          <p className={`text-xl font-bold ${overallScoreColor}`}>
            选定草稿评分: {overallScore}/100
          </p>
        )}
      </header>

      {/* Writer's Overall Response and Instructions */}
      <div className="mb-6 p-4 bg-slate-700/20 rounded-lg border border-slate-600/50">
        <SectionTitle
            title="撰写者指令/提示 (本轮)"
            inputTokens={step.writerInputTokens} // These are aggregate tokens for all drafts
            outputTokens={step.writerOutputTokens}
            className="!pb-2 border-b border-slate-600/50"
        />
        <SectionContentDisplay content={step.writerInstructionLog} isPrompt maxHeight="max-h-36" />
        {step.writerOutput && (
            <>
                <SectionTitle title="撰写者对上一轮整合反馈的回应" className="!mt-3" />
                <SectionContentDisplay content={step.writerOutput.overallResponseToReview} maxHeight="max-h-36" />
            </>
        )}
      </div>

      {/* Drafts Display Area */}
      {step.writerOutput && step.writerOutput.drafts.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-slate-100 mb-3">撰写者生成的草稿:</h4>
          {step.writerOutput.drafts.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-700 pb-2">
              {step.writerOutput.drafts.map((_, index) => (
                <Button
                  key={`tab-${index}`}
                  onClick={() => setActiveDraftTab(index)}
                  variant={activeDraftTab === index ? 'primary' : 'secondary'}
                  className={`px-4 py-2 text-sm ${step.review?.selectedDraftIndex === index ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-sky-400' : ''}`}
                >
                  草稿 {index + 1} {step.review?.selectedDraftIndex === index ? '(已选)' : ''}
                  {step.review?.draftReviews[index] && ` - ${step.review.draftReviews[index].score}/100`}
                </Button>
              ))}
            </div>
          )}
          {/* Display active tab content */}
          {step.writerOutput.drafts.map((draft, index) => (
             activeDraftTab === index && (
                <DraftAndReviewCard
                    key={`draft-card-${index}`}
                    draftNumber={index + 1}
                    writerDraft={draft}
                    draftReview={step.review?.draftReviews?.[index]}
                    isSelected={step.review?.selectedDraftIndex === index}
                    targetScore={targetScore}
                />
             )
          ))}
           {step.writerOutput.drafts.length === 0 && (
             <p className="text-sm text-slate-400 italic py-4">未生成草稿内容。</p>
           )}
        </div>
      )}
      {!step.writerOutput && <p className="text-sm text-slate-400 italic py-4 mb-6">撰写者输出正在等待或处理中...</p>}


      {/* Reviewer's Overall Section */}
      {step.review && (
        <div className="mt-4 p-4 bg-slate-700/20 rounded-lg border border-slate-600/50">
          <SectionTitle
            title="审查者活动总结 (本轮)"
            // Tokens for reviewer are for reviewing ALL drafts in one go.
            // inputTokens={step.review.reviewerInputTokensAggregate} // Assuming you'll add aggregate token fields if needed
            // outputTokens={step.review.reviewerOutputTokensAggregate}
            className="!pb-2 border-b border-slate-600/50"
          />
           {/*
            It might be too verbose to show the full reviewer instruction log again here if it includes all draft contents.
            Consider a more concise summary or omitting it if covered by writer's instruction log.
            For now, let's show the consolidated feedback which is more critical.
           */}
          <div className="mt-3">
            <SectionTitle title="整合审查意见 (用于下一轮)" />
            <SectionContentDisplay content={step.review.consolidatedFeedbackForNextIteration} maxHeight="max-h-60" />
          </div>
        </div>
      )}
      {!step.review && <p className="text-sm text-slate-400 italic py-4">审查结果正在等待或处理中...</p>}

    </article>
  );
};
