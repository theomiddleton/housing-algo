import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Person {
  id: string;
  name: string;
  x: number;
  y: number;
}

interface Match {
  personId: string;
  roomId: string;
  score: number;
}

const rooms: Room[] = [
  { id: 'r1', name: 'Room A', x: 420, y: 60, width: 100, height: 80 },
  { id: 'r2', name: 'Room B', x: 420, y: 160, width: 100, height: 80 },
  { id: 'r3', name: 'Room C', x: 420, y: 260, width: 100, height: 80 },
  { id: 'r4', name: 'Room D', x: 420, y: 360, width: 100, height: 80 },
  { id: 'r5', name: 'Room E', x: 420, y: 460, width: 100, height: 80 },
];

const people: Person[] = [
  { id: 'p1', name: 'Alice', x: 80, y: 80 },
  { id: 'p2', name: 'Bob', x: 80, y: 180 },
  { id: 'p3', name: 'Carol', x: 80, y: 280 },
  { id: 'p4', name: 'Dave', x: 80, y: 380 },
  { id: 'p5', name: 'Emily', x: 80, y: 480 },
];

const finalMatches: Match[] = [
  { personId: 'p1', roomId: 'r3', score: 8.7 },
  { personId: 'p2', roomId: 'r1', score: 9.2 },
  { personId: 'p3', roomId: 'r5', score: 7.8 },
  { personId: 'p4', roomId: 'r2', score: 8.4 },
  { personId: 'p5', roomId: 'r4', score: 9.5 },
];

export function MatchingVisualization() {
  const [phase, setPhase] = useState(0);
  const [activeMatches, setActiveMatches] = useState<Match[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const phases = [
      { delay: 500, matches: [] },
      { delay: 1500, matches: [finalMatches[0]] },
      { delay: 2500, matches: [finalMatches[0], finalMatches[1]] },
      { delay: 3500, matches: [finalMatches[0], finalMatches[1], finalMatches[2]] },
      { delay: 4500, matches: [finalMatches[0], finalMatches[1], finalMatches[2], finalMatches[3]] },
      { delay: 5500, matches: finalMatches },
    ];

    const timeouts = phases.map(({ delay, matches }) =>
      setTimeout(() => setActiveMatches(matches), delay)
    );

    const resetTimeout = setTimeout(() => {
      setActiveMatches([]);
      setPhase((p) => p + 1);
    }, 7000);

    return () => {
      timeouts.forEach(clearTimeout);
      clearTimeout(resetTimeout);
    };
  }, [phase]);

  const getPersonCenter = (personId: string) => {
    const person = people.find((p) => p.id === personId);
    return person ? { x: person.x + 40, y: person.y + 20 } : { x: 0, y: 0 };
  };

  const getRoomCenter = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    return room ? { x: room.x, y: room.y + room.height / 2 } : { x: 0, y: 0 };
  };

  const isMatched = (id: string) =>
    activeMatches.some((m) => m.personId === id || m.roomId === id);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <svg
        ref={svgRef}
        viewBox="0 0 600 600"
        className="w-full h-auto"
        style={{ filter: 'drop-shadow(0 0 20px rgba(255, 200, 0, 0.1))' }}
      >
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffc800" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines */}
        {activeMatches.map((match, idx) => {
          const from = getPersonCenter(match.personId);
          const to = getRoomCenter(match.roomId);
          const midX = (from.x + to.x) / 2;
          
          return (
            <g key={`${match.personId}-${match.roomId}`}>
              <path
                d={`M ${from.x} ${from.y} Q ${midX} ${from.y} ${midX} ${(from.y + to.y) / 2} T ${to.x} ${to.y}`}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="2"
                className="connection-line"
                style={{ animationDelay: `${idx * 0.2}s` }}
                filter="url(#glow)"
              />
              {/* Score badge */}
              <g
                className="animate-fade-in"
                style={{ animationDelay: `${0.3 + idx * 0.2}s`, opacity: 0 }}
              >
                <rect
                  x={midX - 20}
                  y={(from.y + to.y) / 2 - 10}
                  width="40"
                  height="20"
                  rx="2"
                  fill="#1a1a1a"
                  stroke="#ffc800"
                  strokeWidth="1"
                />
                <text
                  x={midX}
                  y={(from.y + to.y) / 2 + 4}
                  textAnchor="middle"
                  className="text-xs font-mono fill-warning"
                >
                  {match.score.toFixed(1)}
                </text>
              </g>
            </g>
          );
        })}

        {/* People */}
        {people.map((person) => (
          <g key={person.id}>
            <rect
              x={person.x}
              y={person.y}
              width="80"
              height="40"
              rx="2"
              className={cn(
                'transition-all duration-300',
                isMatched(person.id)
                  ? 'fill-warning/30 stroke-warning'
                  : 'fill-industrial-card stroke-industrial-border'
              )}
              strokeWidth="2"
              strokeDasharray={isMatched(person.id) ? '0' : '4 2'}
            />
            <text
              x={person.x + 40}
              y={person.y + 24}
              textAnchor="middle"
              className={cn(
                'text-sm font-medium transition-colors duration-300',
                isMatched(person.id) ? 'fill-warning' : 'fill-gray-400'
              )}
            >
              {person.name}
            </text>
          </g>
        ))}

        {/* Rooms */}
        {rooms.map((room) => (
          <g key={room.id}>
            {/* Room outline with floor plan style */}
            <rect
              x={room.x}
              y={room.y}
              width={room.width}
              height={room.height}
              className={cn(
                'transition-all duration-300',
                isMatched(room.id)
                  ? 'fill-orange-500/20 stroke-orange-400'
                  : 'fill-industrial-card stroke-industrial-border'
              )}
              strokeWidth="2"
              strokeDasharray={isMatched(room.id) ? '0' : '4 2'}
            />
            {/* Door indicator */}
            <rect
              x={room.x - 2}
              y={room.y + room.height / 2 - 8}
              width="4"
              height="16"
              className={cn(
                'transition-colors duration-300',
                isMatched(room.id) ? 'fill-orange-400' : 'fill-industrial-border'
              )}
            />
            {/* Room name */}
            <text
              x={room.x + room.width / 2}
              y={room.y + room.height / 2 + 5}
              textAnchor="middle"
              className={cn(
                'text-sm font-medium transition-colors duration-300',
                isMatched(room.id) ? 'fill-orange-300' : 'fill-gray-400'
              )}
            >
              {room.name}
            </text>
          </g>
        ))}

        {/* Labels */}
        <text x="120" y="560" textAnchor="middle" className="text-xs fill-muted-foreground font-medium uppercase tracking-wider">
          People
        </text>
        <text x="470" y="560" textAnchor="middle" className="text-xs fill-muted-foreground font-medium uppercase tracking-wider">
          Rooms
        </text>
      </svg>
    </div>
  );
}
