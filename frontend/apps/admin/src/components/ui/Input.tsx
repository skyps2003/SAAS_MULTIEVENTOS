import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={`flex h-11 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500' : 'border-slate-300 dark:border-slate-700'
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs font-medium text-red-500 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
