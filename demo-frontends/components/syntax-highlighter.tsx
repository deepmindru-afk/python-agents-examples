'use client';

import { useEffect, useRef } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism-tomorrow.css';

interface SyntaxHighlighterProps {
  code: string;
  language?: string;
  className?: string;
}

export function SyntaxHighlighter({ code, language = 'python', className }: SyntaxHighlighterProps) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code]);

  return (
    <pre className={className}>
      <code ref={codeRef} className={`language-${language}`}>
        {code}
      </code>
    </pre>
  );
}