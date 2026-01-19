import * as React from 'react';
import { Button } from './ui/button';
import { ExternalLink } from 'lucide-react';

const ASSIGNMENT_URL = 'https://raw.githubusercontent.com/theomiddleton/housing-algo/refs/heads/main/apps/cli/lib/assignment.ts';
const SCORING_URL = 'https://raw.githubusercontent.com/theomiddleton/housing-algo/refs/heads/main/apps/cli/lib/scoring.ts';

const PROMPT = `Please review the following housing allocation algorithm for fairness and potential bias.

This algorithm is used to assign people to rooms in shared housing. I want you to analyze:

1. **Fairness**: Does the algorithm treat all applicants equitably? Are there any factors that could disadvantage certain groups?

2. **Transparency**: Is the scoring system clear and understandable? Could an applicant understand why they received a particular assignment?

3. **Potential Bias**: Are there any weighted factors that could introduce unintended discrimination (e.g., based on protected characteristics)?

4. **Edge Cases**: How does the algorithm handle ties, edge cases, or situations with limited room availability?

5. **Improvements**: What changes would make this algorithm more fair or transparent?

Here is the source code:

## assignment.ts (Hungarian Algorithm Implementation)
\`\`\`typescript
[Content from ${ASSIGNMENT_URL}]
\`\`\`

## scoring.ts (Score Calculation)
\`\`\`typescript
[Content from ${SCORING_URL}]
\`\`\`

Please fetch the actual code from these URLs and provide a comprehensive fairness review.`;

function buildChatGPTUrl(): string {
  const encodedPrompt = encodeURIComponent(PROMPT);
  return `https://chat.openai.com/?q=${encodedPrompt}`;
}

interface ChatGPTReviewButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
  showDescription?: boolean;
  className?: string;
}

export function ChatGPTReviewButton({ 
  variant = 'outline', 
  size = 'default',
  showDescription = true,
  className = ''
}: ChatGPTReviewButtonProps) {
  const handleClick = () => {
    window.open(buildChatGPTUrl(), '_blank', 'noopener,noreferrer');
  };

  if (showDescription) {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Want to verify this algorithm is fair? Get an independent AI review of the source code.
        </p>
        <Button variant={variant} size={size} onClick={handleClick}>
          <ExternalLink className="w-4 h-4" />
          Review with ChatGPT
        </Button>
      </div>
    );
  }

  return (
    <Button variant={variant} size={size} onClick={handleClick} className={className}>
      <ExternalLink className="w-4 h-4" />
      Review with ChatGPT
    </Button>
  );
}
