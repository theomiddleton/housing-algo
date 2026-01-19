import { useState, useMemo } from 'react';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

interface Weight {
  id: string;
  name: string;
  description: string;
  defaultValue: number;
  min: number;
  max: number;
  category: 'preference' | 'priority' | 'bonus';
}

const weights: Weight[] = [
  // Preference weights
  { id: 'size', name: 'Room Size', description: 'Preference for larger rooms (square meters)', defaultValue: 4, min: 0, max: 10, category: 'preference' },
  { id: 'windows', name: 'Windows', description: 'Preference for more windows', defaultValue: 2, min: 0, max: 10, category: 'preference' },
  { id: 'attractiveness', name: 'Attractiveness', description: 'Overall room appeal and aesthetics', defaultValue: 3, min: 0, max: 10, category: 'preference' },
  { id: 'bedType', name: 'Bed Type', description: 'Preference for double vs single bed', defaultValue: 5, min: 0, max: 10, category: 'preference' },
  { id: 'sunlight', name: 'Sunlight', description: 'Natural light level preference', defaultValue: 2, min: 0, max: 10, category: 'preference' },
  { id: 'storage', name: 'Storage', description: 'Storage space availability', defaultValue: 2, min: 0, max: 10, category: 'preference' },
  { id: 'quiet', name: 'Quiet', description: 'Inverse of noise level (quieter is better)', defaultValue: 3, min: 0, max: 10, category: 'preference' },
  { id: 'kitchenProximity', name: 'Kitchen Proximity', description: 'Closeness to kitchen', defaultValue: 2, min: 0, max: 10, category: 'preference' },
  { id: 'ensuite', name: 'Ensuite', description: 'Private bathroom attached', defaultValue: 2, min: 0, max: 10, category: 'preference' },
  { id: 'floor', name: 'Floor Level', description: 'Preference for upper floors', defaultValue: 2, min: 0, max: 10, category: 'preference' },
  // Priority weights
  { id: 'foundHouse', name: 'Found House', description: 'Bonus for finding the listing', defaultValue: 6, min: 0, max: 10, category: 'priority' },
  { id: 'handledAgent', name: 'Handled Agent', description: 'Bonus for dealing with letting agent', defaultValue: 4, min: 0, max: 10, category: 'priority' },
  { id: 'attendedViewing', name: 'Attended Viewing', description: 'Bonus for attending property viewings', defaultValue: 2, min: 0, max: 10, category: 'priority' },
  // Bonus/penalty weights
  { id: 'safetyConcern', name: 'Safety Concern', description: 'Penalty for ground/front-facing rooms', defaultValue: 4, min: 0, max: 10, category: 'bonus' },
  { id: 'bedUpgrade', name: 'Bed Upgrade', description: 'Bonus for upgrading single to double', defaultValue: 2.5, min: 0, max: 10, category: 'bonus' },
  { id: 'bedDowngrade', name: 'Bed Downgrade', description: 'Penalty for downgrading double to single', defaultValue: 3, min: 0, max: 10, category: 'bonus' },
];

// Mock room data for score calculation
const mockRoom = {
  size: 0.7,
  windows: 0.5,
  attractiveness: 0.8,
  bedType: 1, // double
  sunlight: 0.6,
  storage: 0.4,
  quiet: 0.7,
  kitchenProximity: 0.3,
  ensuite: 1,
  floor: 1,
};

export function WeightExplorer() {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(weights.map((w) => [w.id, w.defaultValue]))
  );

  const updateWeight = (id: string, value: number) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const resetAll = () => {
    setValues(Object.fromEntries(weights.map((w) => [w.id, w.defaultValue])));
  };

  // Calculate mock score
  const score = useMemo(() => {
    const preferenceWeights = weights.filter((w) => w.category === 'preference');
    let total = 0;
    let maxPossible = 0;

    preferenceWeights.forEach((w) => {
      const roomValue = mockRoom[w.id as keyof typeof mockRoom] ?? 0.5;
      total += values[w.id] * roomValue;
      maxPossible += values[w.id];
    });

    // Add bonus for ensuite (example)
    if (mockRoom.ensuite) {
      total += values.bedUpgrade || 0;
    }

    return {
      raw: total,
      normalized: maxPossible > 0 ? (total / maxPossible) * 10 : 0,
      max: maxPossible,
    };
  }, [values]);

  const categories = [
    { id: 'preference', name: 'Preference Weights', description: 'How much each room attribute matters' },
    { id: 'priority', name: 'Priority Weights', description: 'Contribution-based priority scoring' },
    { id: 'bonus', name: 'Bonuses & Penalties', description: 'Special case adjustments' },
  ];

  return (
    <div className="space-y-8">
      {/* Live score display */}
      <div className="industrial-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100">Live Score Preview</h3>
          <button
            onClick={resetAll}
            className="text-sm text-warning hover:text-warning/80 transition-colors"
          >
            Reset to defaults
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-warning font-mono">
              {score.normalized.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Normalized Score</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-400 font-mono">
              {score.raw.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Raw Score</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-400 font-mono">
              {score.max.toFixed(0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Max Possible</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Preview based on a sample room with: 70% size, 50% windows, 80% attractiveness, double bed, 60% sunlight, ensuite
        </p>
      </div>

      {/* Weight sliders by category */}
      {categories.map((category) => (
        <div key={category.id} className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold text-gray-100">{category.name}</h3>
            <Badge variant={category.id === 'bonus' ? 'amber' : 'default'}>
              {weights.filter((w) => w.category === category.id).length} weights
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{category.description}</p>

          <div className="grid gap-6">
            {weights
              .filter((w) => w.category === category.id)
              .map((weight) => (
                <div key={weight.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-300">
                      {weight.name}
                    </label>
                    <span className="text-sm font-mono text-warning min-w-[3rem] text-right">
                      {values[weight.id].toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    value={[values[weight.id]]}
                    onValueChange={([v]) => updateWeight(weight.id, v)}
                    min={weight.min}
                    max={weight.max}
                    step={0.5}
                  />
                  <p className="text-xs text-muted-foreground">{weight.description}</p>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
