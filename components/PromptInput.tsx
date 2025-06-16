
import React from 'react';

interface PromptInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const PromptInput: React.FC<PromptInputProps> = ({ id, label, value, onChange, placeholder, disabled }) => {
  return (
    <div className="mb-4"> {/* Reduced bottom margin from mb-6 */}
      <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        rows={4}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="block w-full rounded-lg border border-slate-600 bg-slate-700/50 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 sm:text-sm p-3 text-slate-100 disabled:opacity-60 placeholder-slate-400 scrollbar-thin transition-colors"
      />
    </div>
  );
};