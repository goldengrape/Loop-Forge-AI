
import React, { useState, useCallback } from 'react';
import { Part } from '@google/genai';
import { Button } from './Button';
import { UploadedFilePart } from '../types'; // Import the new type

interface FileUploadProps {
  onFileUploaded: (uploadedFileParts: UploadedFilePart[]) => void;
  disabled?: boolean;
}

const fileToUploadedFilePart = async (file: File): Promise<UploadedFilePart> => {
  let part: Part;
  if (file.type.startsWith('text/')) {
    const text = await file.text();
    part = { text };
  } else if (file.type.startsWith('image/') || file.type.startsWith('application/pdf')) {
    const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
    const data = await base64EncodedDataPromise;
    part = {
      inlineData: {
        mimeType: file.type,
        data,
      },
    };
  } else {
    console.warn(`Unsupported file type ${file.type} for file "${file.name}" treated as text. For best results, use text, images, or PDFs.`);
    const text = await file.text().catch(() => `File content from "${file.name}" could not be read as text.`);
    part = { text };
  }

  return {
    id: `${file.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).substring(2, 9)}`, // Generate a reasonably unique ID
    name: file.name,
    part: part,
  };
};


export const FileUpload: React.FC<FileUploadProps> = ({ onFileUploaded, disabled }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info'>('info');


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setSelectedFiles(newFiles);
      if (newFiles.length > 0) {
        setFeedbackMessage(`${newFiles.length} 个文件已选择。点击“确认上传”进行处理。`);
        setFeedbackType('info');
      } else {
        setFeedbackMessage('');
      }
    }
  };

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) {
      setFeedbackMessage('请选择至少一个文件。');
      setFeedbackType('error');
      return;
    }
    setFeedbackMessage('正在处理文件...');
    setFeedbackType('info');
    try {
      const uploadedFilePartsArray = await Promise.all(selectedFiles.map(file => fileToUploadedFilePart(file)));
      onFileUploaded(uploadedFilePartsArray);
      setFeedbackMessage(`${selectedFiles.length} 个文件处理成功！`);
      setFeedbackType('success');
      setSelectedFiles([]); 
      // Clear file input visually
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      console.error("文件处理失败:", error);
      setFeedbackMessage('文件处理失败。请检查控制台获取更多信息。');
      setFeedbackType('error');
    }
  }, [selectedFiles, onFileUploaded]);

  const feedbackColor = feedbackType === 'success' ? 'text-green-400' : feedbackType === 'error' ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="mb-2">
      <label htmlFor="file-upload" className="block text-sm font-medium text-slate-300 mb-2">
        上传背景资料 (Upload Background Material)
      </label>
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-3">
        <div className="relative flex-grow">
           <input
            id="file-upload"
            name="file-upload"
            type="file"
            multiple
            onChange={handleFileChange}
            disabled={disabled}
            className="block w-full text-sm text-slate-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-600 file:text-sky-50 hover:file:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-60 cursor-pointer border border-slate-600 rounded-lg bg-slate-700/50"
            aria-describedby="file-upload-feedback"
          />
        </div>
        <Button 
            onClick={handleUpload} 
            disabled={disabled || selectedFiles.length === 0} 
            className="w-full sm:w-auto px-5 py-2.5 flex items-center justify-center"
            variant={selectedFiles.length > 0 ? "primary" : "secondary"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
            <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.162 1.73a.75.75 0 1 0 .976-1.213l-3.25-2.6a.75.75 0 0 0-.976 0l-3.25 2.6a.75.75 0 0 0 .976 1.213L9.25 4.636v8.614Z" />
            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
          </svg>
          确认上传
        </Button>
      </div>
      {feedbackMessage && <p id="file-upload-feedback" className={`mt-2.5 text-sm ${feedbackColor}`}>{feedbackMessage}</p>}
       <p className="mt-1.5 text-xs text-slate-500">支持：文本, 图片, PDF。其他类型将尝试作为文本处理。</p>
    </div>
  );
};