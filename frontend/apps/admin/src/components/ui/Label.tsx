import React from 'react';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={`text-sm font-semibold leading-none text-slate-700 dark:text-slate-200 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
        {...props}
      />
    );
  }
);
Label.displayName = 'Label';
