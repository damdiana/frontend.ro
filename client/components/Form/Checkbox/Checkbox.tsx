import React, { PropsWithChildren } from 'react';

import styles from './Checkbox.module.scss';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  variant?: 'success' | 'black';
}

export default function Checkbox({
  children,
  className = '',
  variant = 'success',
  ...props
}: PropsWithChildren<Props>) {
  return (
    <label className={`${styles['checkbox-wrapper']} ${className}`}>
      <span className={`${styles.checkbox} ${styles[variant]}`}>
        <input className="absolute" type="checkbox" {...props} />
        <span className={`${styles['control-indicator']} d-inline-block`} />
      </span>
      {children}
    </label>
  );
}
