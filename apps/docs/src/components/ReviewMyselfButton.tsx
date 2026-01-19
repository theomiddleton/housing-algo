import * as React from 'react';
import { Button } from './ui/button';
import { Code } from 'lucide-react';

const REPO_URL = 'https://github.com/theomiddleton/housing-algo/tree/main/apps/cli';

interface ReviewMyselfButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function ReviewMyselfButton({ 
  variant = 'outline', 
  size = 'default',
  className = ''
}: ReviewMyselfButtonProps) {
  const handleClick = () => {
    window.open(REPO_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <Button variant={variant} size={size} onClick={handleClick} className={className}>
      <Code className="w-4 h-4" />
      Review it myself
    </Button>
  );
}
