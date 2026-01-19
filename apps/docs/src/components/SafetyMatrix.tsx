import { cn } from '@/lib/utils';

interface SafetyMatrixProps {
  className?: string;
}

const safetyData = [
  { floor: 'Ground Floor', front: 1.0, back: 0.5 },
  { floor: 'Upper Floor', front: 0.25, back: 0.0 },
];

function getRiskLevel(risk: number): { label: string; color: string } {
  if (risk === 0) return { label: 'Safest', color: 'text-emerald-400 bg-emerald-500/20' };
  if (risk <= 0.25) return { label: 'Low Risk', color: 'text-warning bg-warning/20' };
  if (risk <= 0.5) return { label: 'Medium', color: 'text-orange-400 bg-orange-500/20' };
  return { label: 'High Risk', color: 'text-red-400 bg-red-500/20' };
}

export function SafetyMatrix({ className }: SafetyMatrixProps) {
  return (
    <div className={cn('', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="p-4 text-left text-sm text-muted-foreground"></th>
              <th className="p-4 text-center text-sm font-medium text-gray-100">
                Front Facing
              </th>
              <th className="p-4 text-center text-sm font-medium text-gray-100">
                Back Facing
              </th>
            </tr>
          </thead>
          <tbody>
            {safetyData.map((row) => (
              <tr key={row.floor}>
                <td className="p-4 text-sm font-medium text-gray-100">
                  {row.floor}
                </td>
                <td className="p-4">
                  <div
                    className={cn(
                      'text-center py-3 px-4 rounded-lg',
                      getRiskLevel(row.front).color
                    )}
                  >
                    <div className="font-mono text-lg font-bold">
                      {row.front.toFixed(1)}
                    </div>
                    <div className="text-xs mt-1 opacity-75">
                      {getRiskLevel(row.front).label}
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div
                    className={cn(
                      'text-center py-3 px-4 rounded-lg',
                      getRiskLevel(row.back).color
                    )}
                  >
                    <div className="font-mono text-lg font-bold">
                      {row.back.toFixed(1)}
                    </div>
                    <div className="text-xs mt-1 opacity-75">
                      {getRiskLevel(row.back).label}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-industrial-card/50 border border-industrial-border">
        <h4 className="text-sm font-medium text-gray-100 mb-2">How Safety Risk is Calculated</h4>
        <p className="text-sm text-muted-foreground">
          Safety risk is used to penalize room assignments for residents with safety concerns.
          Ground floor rooms are riskier than upper floors, and front-facing rooms (visible from street)
          are riskier than back-facing rooms. The penalty applied is:{' '}
          <code className="text-warning font-mono">safetyWeight × riskScore</code>
        </p>
      </div>
    </div>
  );
}
