import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

type Cell = {
  value: number;
  covered: boolean;
  starred: boolean;
  primed: boolean;
};

type MatrixState = {
  cells: Cell[][];
  rowCovered: boolean[];
  colCovered: boolean[];
  step: number;
  description: string;
};

// Initial cost matrix (we'll work with scores, so we negate for Hungarian)
const initialMatrix = [
  [8.2, 6.5, 9.1, 7.3],
  [7.8, 8.9, 6.2, 8.1],
  [6.4, 7.2, 8.6, 9.2],
  [9.0, 7.8, 7.4, 6.8],
];

const people = ['Alice', 'Bob', 'Carol', 'Dave'];
const rooms = ['Room A', 'Room B', 'Room C', 'Room D'];

function createInitialState(): MatrixState {
  return {
    cells: initialMatrix.map((row) =>
      row.map((value) => ({
        value,
        covered: false,
        starred: false,
        primed: false,
      }))
    ),
    rowCovered: [false, false, false, false],
    colCovered: [false, false, false, false],
    step: 0,
    description: 'Initial score matrix showing compatibility scores for each person-room pair.',
  };
}

// Simulation steps for the Hungarian algorithm
const simulationSteps: Partial<MatrixState>[] = [
  {
    description: 'Step 1: Find the maximum value in each row.',
    cells: initialMatrix.map((row) => {
      const max = Math.max(...row);
      return row.map((value) => ({
        value,
        covered: value === max,
        starred: false,
        primed: false,
      }));
    }),
  },
  {
    description: 'Step 2: Subtract each element from the row maximum (convert to cost matrix for minimization).',
    cells: initialMatrix.map((row) => {
      const max = Math.max(...row);
      return row.map((value) => ({
        value: Number((max - value).toFixed(1)),
        covered: false,
        starred: value === max,
        primed: false,
      }));
    }),
  },
  {
    description: 'Step 3: Find zeros and star them (one per row/column). These are potential assignments.',
    cells: [
      [{ value: 0.9, covered: false, starred: false, primed: false }, { value: 2.6, covered: false, starred: false, primed: false }, { value: 0, covered: false, starred: true, primed: false }, { value: 1.8, covered: false, starred: false, primed: false }],
      [{ value: 1.1, covered: false, starred: false, primed: false }, { value: 0, covered: false, starred: true, primed: false }, { value: 2.7, covered: false, starred: false, primed: false }, { value: 0.8, covered: false, starred: false, primed: false }],
      [{ value: 2.8, covered: false, starred: false, primed: false }, { value: 2.0, covered: false, starred: false, primed: false }, { value: 0.6, covered: false, starred: false, primed: false }, { value: 0, covered: false, starred: true, primed: false }],
      [{ value: 0, covered: false, starred: true, primed: false }, { value: 1.2, covered: false, starred: false, primed: false }, { value: 1.6, covered: false, starred: false, primed: false }, { value: 2.2, covered: false, starred: false, primed: false }],
    ],
  },
  {
    description: 'Step 4: Cover columns containing starred zeros. We have 4 lines = optimal assignment found!',
    cells: [
      [{ value: 0.9, covered: true, starred: false, primed: false }, { value: 2.6, covered: true, starred: false, primed: false }, { value: 0, covered: true, starred: true, primed: false }, { value: 1.8, covered: true, starred: false, primed: false }],
      [{ value: 1.1, covered: true, starred: false, primed: false }, { value: 0, covered: true, starred: true, primed: false }, { value: 2.7, covered: true, starred: false, primed: false }, { value: 0.8, covered: true, starred: false, primed: false }],
      [{ value: 2.8, covered: true, starred: false, primed: false }, { value: 2.0, covered: true, starred: false, primed: false }, { value: 0.6, covered: true, starred: false, primed: false }, { value: 0, covered: true, starred: true, primed: false }],
      [{ value: 0, covered: true, starred: true, primed: false }, { value: 1.2, covered: true, starred: false, primed: false }, { value: 1.6, covered: true, starred: false, primed: false }, { value: 2.2, covered: true, starred: false, primed: false }],
    ],
    colCovered: [true, true, true, true],
  },
  {
    description: 'Final: Optimal assignment complete. Alice→Room C (9.1), Bob→Room B (8.9), Carol→Room D (9.2), Dave→Room A (9.0). Total: 36.2',
    cells: [
      [{ value: 8.2, covered: false, starred: false, primed: false }, { value: 6.5, covered: false, starred: false, primed: false }, { value: 9.1, covered: false, starred: true, primed: false }, { value: 7.3, covered: false, starred: false, primed: false }],
      [{ value: 7.8, covered: false, starred: false, primed: false }, { value: 8.9, covered: false, starred: true, primed: false }, { value: 6.2, covered: false, starred: false, primed: false }, { value: 8.1, covered: false, starred: false, primed: false }],
      [{ value: 6.4, covered: false, starred: false, primed: false }, { value: 7.2, covered: false, starred: false, primed: false }, { value: 8.6, covered: false, starred: false, primed: false }, { value: 9.2, covered: false, starred: true, primed: false }],
      [{ value: 9.0, covered: false, starred: true, primed: false }, { value: 7.8, covered: false, starred: false, primed: false }, { value: 7.4, covered: false, starred: false, primed: false }, { value: 6.8, covered: false, starred: false, primed: false }],
    ],
  },
];

export function HungarianViz() {
  const [state, setState] = useState<MatrixState>(createInitialState());
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (stepIndex === 0) {
      setState(createInitialState());
    } else {
      const step = simulationSteps[stepIndex - 1];
      setState((prev) => ({
        ...prev,
        ...step,
        step: stepIndex,
      }));
    }
  }, [stepIndex]);

  // Auto-play effect
  useEffect(() => {
    if (!isPlaying) return;

    if (stepIndex >= simulationSteps.length) {
      setIsPlaying(false);
      return;
    }

    const timer = setTimeout(() => {
      setStepIndex((prev) => prev + 1);
    }, 1500);

    return () => clearTimeout(timer);
  }, [isPlaying, stepIndex]);

  const prevStep = () => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1);
    }
  };

  const nextStep = () => {
    if (stepIndex < simulationSteps.length) {
      setStepIndex((prev) => prev + 1);
    }
  };

  const togglePlay = () => {
    if (stepIndex >= simulationSteps.length) {
      // Reset to beginning if at end
      setStepIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevStep} disabled={stepIndex === 0 || isPlaying}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={togglePlay}>
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={nextStep}
            disabled={stepIndex >= simulationSteps.length || isPlaying}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <span className="text-sm text-muted-foreground font-mono">
          Step {stepIndex} / {simulationSteps.length}
        </span>
      </div>

      {/* Matrix display */}
      <div className="overflow-x-auto p-1">
        <table className="w-full">
          <thead>
            <tr>
              <th className="p-3 text-left text-sm text-muted-foreground"></th>
              {rooms.map((room, idx) => (
                <th
                  key={room}
                  className={cn(
                    'p-3 text-center text-sm font-medium',
                    state.colCovered?.[idx]
                      ? 'text-warning bg-warning/10'
                      : 'text-muted-foreground'
                  )}
                >
                  {room}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.cells.map((row, rowIdx) => (
              <tr key={people[rowIdx]}>
                <td
                  className={cn(
                    'p-3 text-sm font-medium',
                    state.rowCovered?.[rowIdx]
                      ? 'text-warning bg-warning/10'
                      : 'text-muted-foreground'
                  )}
                >
                  {people[rowIdx]}
                </td>
                {row.map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    className={cn(
                      'p-3 text-center transition-all duration-300',
                      cell.starred && 'bg-warning/30 ring-2 ring-warning',
                      cell.covered && !cell.starred && 'bg-industrial-border/50',
                      cell.primed && 'bg-orange-500/20'
                    )}
                  >
                    <span
                      className={cn(
                        'font-mono text-lg transition-colors',
                        cell.starred ? 'text-warning font-bold' : 'text-gray-400',
                        cell.value === 0 && 'text-orange-400'
                      )}
                    >
                      {cell.value.toFixed(1)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Description */}
      <div className="blueprint-card p-4">
        <p className="text-sm text-gray-300">{state.description}</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-warning/30 ring-2 ring-warning" />
          <span>Starred (assigned)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-industrial-border/50" />
          <span>Covered</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-orange-400">0.0</span>
          <span>Zero value</span>
        </div>
      </div>
    </div>
  );
}
