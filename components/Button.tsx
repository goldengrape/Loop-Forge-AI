
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
}

export const Button: React.FC<ButtonProps> = ({ children, className, variant = 'primary', ...props }) => {
  const baseStyle = "px-5 py-2.5 rounded-lg font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]";
  
  let variantStyle = "";
  switch (variant) {
    case 'secondary':
      variantStyle = "bg-slate-600 text-slate-100 hover:bg-slate-500 focus:ring-slate-400";
      break;
    case 'danger':
      variantStyle = "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500";
      break;
    case 'success':
      variantStyle = "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500";
      break;
    case 'warning':
      variantStyle = "bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-400";
      break;
    case 'primary':
    default:
      variantStyle = "bg-sky-600 text-white hover:bg-sky-700 focus:ring-sky-500";
      break;
  }

  return (
    <button
      className={`${baseStyle} ${variantStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};