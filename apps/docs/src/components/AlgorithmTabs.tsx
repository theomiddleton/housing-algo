import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';

export function AlgorithmTabs() {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="scoring">Scoring</TabsTrigger>
        <TabsTrigger value="matching">Matching</TabsTrigger>
        <TabsTrigger value="tiebreak">Tie-Breaking</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <Card>
          <CardContent className="pt-6 prose prose-invert max-w-none">
            <h3 className="text-xl font-semibold text-gray-100 mb-4">Problem Statement</h3>
            <p className="text-muted-foreground mb-4">
              Given <strong className="text-warning">n people</strong> and <strong className="text-warning">n rooms</strong>, 
              where each person has different preferences for each room, find an assignment of people to rooms 
              such that the <strong className="text-orange-400">total satisfaction is maximized</strong>.
            </p>
            
            <h3 className="text-xl font-semibold text-gray-100 mb-4 mt-8">Why Hungarian Algorithm?</h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-warning mt-2 flex-shrink-0"></div>
                <span><strong className="text-gray-100">Globally Optimal:</strong> Unlike greedy approaches, 
                it considers all possible assignments simultaneously.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-warning mt-2 flex-shrink-0"></div>
                <span><strong className="text-gray-100">Polynomial Time:</strong> O(n³) complexity makes it 
                practical for real-world use.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-warning mt-2 flex-shrink-0"></div>
                <span><strong className="text-gray-100">Deterministic:</strong> Same input always produces 
                the same output (with proper tie-breaking).</span>
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-100 mb-4 mt-8">Complexity Analysis</h3>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="industrial-card p-4 text-center">
                <div className="text-2xl font-mono font-bold text-warning">O(n³)</div>
                <div className="text-sm text-muted-foreground mt-1">Time</div>
              </div>
              <div className="industrial-card p-4 text-center">
                <div className="text-2xl font-mono font-bold text-orange-400">O(n²)</div>
                <div className="text-sm text-muted-foreground mt-1">Space</div>
              </div>
              <div className="industrial-card p-4 text-center">
                <div className="text-2xl font-mono font-bold text-emerald-400">100%</div>
                <div className="text-sm text-muted-foreground mt-1">Optimal</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="scoring">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-xl font-semibold text-gray-100 mb-4">Score Calculation</h3>
            <p className="text-muted-foreground mb-6">
              For each person-room pair, we calculate a score based on weighted preferences, 
              bonuses, penalties, and priority multipliers. This is all customisable. You can adjust the weights, bonuses, penalties, and priority multipliers to fit your specific needs.
            </p>

            <div className="code-block p-4 mb-6">
              <code className="text-sm text-gray-300">
                <span className="text-purple-400">score</span> = (<span className="text-warning">preferences</span> + <span className="text-emerald-400">bonuses</span> - <span className="text-red-400">penalties</span>) × <span className="text-orange-400">priorityMultiplier</span>
              </code>
            </div>

            <h4 className="font-semibold text-gray-100 mb-3">Preferences</h4>
            <p className="text-sm text-muted-foreground mb-4">
              These preferences are customisable, or ignoreable.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Sum of (weight × normalized_room_attribute) for each preference:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
              {['size', 'windows', 'sunlight', 'storage', 'quiet'].map(pref => (
                <div key={pref} className="industrial-card p-2 text-center text-xs">
                  <span className="text-warning">{pref}</span>
                </div>
              ))}
            </div>

            <h4 className="font-semibold text-gray-100 mb-3">Bonuses</h4>
            <ul className="space-y-2 text-sm text-muted-foreground mb-6">
              <li>• <strong className="text-emerald-400">Bed Upgrade:</strong> Single → Double bed preference match</li>
              <li>• <strong className="text-emerald-400">External Partner:</strong> Bonus for double bed when partnered</li>
              <li>• <strong className="text-emerald-400">Internal Couple:</strong> Smart allocation for housemate couples</li>
            </ul>

            <h4 className="font-semibold text-gray-100 mb-3">Penalties</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• <strong className="text-red-400">Bed Downgrade:</strong> Double → Single bed</li>
              <li>• <strong className="text-red-400">Safety Concern:</strong> Ground floor / front-facing for concerned residents</li>
            </ul>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="matching">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-xl font-semibold text-gray-100 mb-4">The Matching Process</h3>
            
            <Accordion type="single" collapsible>
              <AccordionItem value="step1">
                <AccordionTrigger>1. Build the Score Matrix</AccordionTrigger>
                <AccordionContent>
                  Create an n×n matrix where entry (i,j) represents how much person i 
                  wants room j. Higher scores = stronger preference.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="step2">
                <AccordionTrigger>2. Convert to Cost Matrix</AccordionTrigger>
                <AccordionContent>
                  The Hungarian algorithm minimizes cost, so we convert by subtracting 
                  each value from the row maximum. This preserves relative ordering.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="step3">
                <AccordionTrigger>3. Row and Column Reduction</AccordionTrigger>
                <AccordionContent>
                  Subtract the minimum value from each row, then from each column. 
                  This creates zeros which represent potential assignments.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="step4">
                <AccordionTrigger>4. Cover Zeros</AccordionTrigger>
                <AccordionContent>
                  Find the minimum number of lines needed to cover all zeros. 
                  If this equals n, we have an optimal assignment!
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="step5">
                <AccordionTrigger>5. Adjust Matrix (if needed)</AccordionTrigger>
                <AccordionContent>
                  If fewer than n lines cover all zeros: find minimum uncovered value, 
                  subtract from uncovered cells, add to doubly-covered cells. Repeat step 4.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="step6">
                <AccordionTrigger>6. Extract Assignment</AccordionTrigger>
                <AccordionContent>
                  Select one zero from each row and column. These zeros indicate 
                  the optimal assignment that maximizes total satisfaction.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tiebreak">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-xl font-semibold text-gray-100 mb-4">Deterministic Tie-Breaking</h3>
            <p className="text-muted-foreground mb-6">
              When multiple assignments have the same total score, we need a consistent 
              way to choose. This ensures the same input always produces the same output.
            </p>

            <h4 className="font-semibold text-gray-100 mb-3">The Problem</h4>
            <p className="text-sm text-muted-foreground mb-6">
              If two different assignments have equal total scores, the algorithm might 
              return different results based on input order. This feels unfair and 
              makes results unpredictable.
            </p>

            <h4 className="font-semibold text-gray-100 mb-3">The Solution: Epsilon Perturbation</h4>
            <ol className="space-y-3 text-sm text-muted-foreground mb-6">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0 text-warning font-mono text-xs">1</span>
                <span>Generate a hash from <code className="text-warning">personId:roomId</code> using FNV-1a</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0 text-warning font-mono text-xs">2</span>
                <span>Convert hash to a tiny epsilon value (e.g., 0.0000001)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0 text-warning font-mono text-xs">3</span>
                <span>Add epsilon to each score before running the algorithm</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0 text-warning font-mono text-xs">4</span>
                <span>Ties are now broken consistently based on ID hashes</span>
              </li>
            </ol>

            <div className="blueprint-card p-4">
              <h4 className="font-semibold text-gray-100 mb-2">Key Properties</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• <strong className="text-warning">Order-independent:</strong> Shuffling input arrays doesn't change results</li>
                <li>• <strong className="text-warning">Deterministic:</strong> Same IDs always produce same epsilon</li>
                <li>• <strong className="text-warning">Negligible:</strong> Epsilon is too small to affect meaningful differences</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
