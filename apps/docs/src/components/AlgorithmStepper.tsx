import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  title: string;
  description: string;
  details: string[];
}

const steps: Step[] = [
  {
    id: 1,
    title: 'Generate Data with CLI Tools',
    description: 'Use the house and people CLI tools to build your configuration files.',
    details: [
      'Run `bun run rightmove --url "https://rightmove.co.uk/..."` to scrape a property listing',
      'AI automatically identifies rooms from floorplans and photos',
      'Each room gets an attractiveness score (0-10) based on size, windows, sunlight, and features',
      'Run `bun run residents` to interactively add people with their preferences and weights',
      'Define relationship status, bed type preferences, safety concerns, and contribution priorities',
      'Result: house.json with room data and people.json with resident preferences',
    ],
  },
  {
    id: 2,
    title: 'Build Person Metadata',
    description: 'Calculate priority scores and merge default weights with personal overrides.',
    details: [
      'Calculate priority score from contributions (found house, handled agent, attended viewing)',
      'Apply priority multiplier: 1 + (priorityScore / priorityScale)',
      'Merge person-specific weight overrides with defaults',
      'Identify relationship status and special cases (couples, partners)',
    ],
  },
  {
    id: 3,
    title: 'Construct Score Matrix',
    description: 'For each person-room pair, calculate a weighted preference score.',
    details: [
      'For each (person, room) pair, sum: weight × normalized_attribute',
      'Apply bonuses: bed upgrade, external partner double bed, internal couple logic',
      'Apply penalties: bed downgrade, safety concerns (ground floor, front-facing)',
      'Apply priority multiplier based on mode (amplify or bonus)',
    ],
  },
  {
    id: 4,
    title: 'Hungarian Algorithm',
    description: 'Find the optimal assignment that maximizes total satisfaction.',
    details: [
      'Initialize: Subtract row minimums, then column minimums',
      'Cover all zeros with minimum number of lines',
      'If lines < n: find minimum uncovered value, adjust matrix',
      'Repeat until optimal assignment found (n lines cover all zeros)',
    ],
  },
  {
    id: 5,
    title: 'Deterministic Tie-Breaking',
    description: 'Apply epsilon perturbation to ensure consistent results.',
    details: [
      'Generate hash from person ID + room ID combination',
      'Apply tiny epsilon offset based on hash (prevents ties)',
      'Ensures same input always produces same output',
      'Order-independent: results don\'t change based on array order',
    ],
  },
  {
    id: 6,
    title: 'Output Assignment',
    description: 'Return the optimal room assignments with scores and reasoning.',
    details: [
      'Map each person to their assigned room',
      'Calculate individual and total satisfaction scores',
      'Generate human-readable reasons for each assignment',
      'Output in JSON or formatted table view',
    ],
  },
];

export function AlgorithmStepper() {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const step = steps[currentStep];

  return (
    <div className="space-y-8">
      {/* Progress bar */}
      <div className="relative">
        <div className="flex justify-between mb-2">
          {steps.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(idx)}
              className={cn(
                'relative z-10 w-10 h-10 flex items-center justify-center text-sm font-bold transition-all',
                idx < currentStep
                  ? 'bg-warning text-industrial-bg'
                  : idx === currentStep
                  ? 'bg-warning text-industrial-bg ring-4 ring-warning/30'
                  : 'bg-industrial-card text-muted-foreground border border-industrial-border'
              )}
            >
              {s.id}
            </button>
          ))}
        </div>
        {/* Progress line */}
        <div className="absolute top-5 left-5 right-5 h-0.5 bg-industrial-border -z-0">
          <div
            className="h-full bg-gradient-to-r from-warning to-orange-500 transition-all duration-500"
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Current step content */}
      <div className="blueprint-card-glow p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className="text-warning text-sm font-mono">Step {step.id} of {steps.length}</span>
            <h3 className="text-2xl font-bold text-gray-100 mt-1">{step.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevStep} disabled={currentStep === 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextStep} disabled={currentStep === steps.length - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <p className="text-lg text-muted-foreground mb-6">{step.description}</p>

        <div className="space-y-3">
          {step.details.map((detail, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 animate-fade-in"
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              <div className="w-6 h-6 bg-warning/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-mono text-warning">{idx + 1}</span>
              </div>
              <p className="text-sm text-gray-300">{detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Step labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        {steps.map((s, idx) => (
          <div
            key={s.id}
            className={cn(
              'text-center max-w-[80px] transition-colors',
              idx === currentStep && 'text-warning'
            )}
          >
            {s.title}
          </div>
        ))}
      </div>
    </div>
  );
}
