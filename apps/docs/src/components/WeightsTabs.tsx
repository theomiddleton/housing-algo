import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { SafetyMatrix } from './SafetyMatrix';

export function WeightsTabs() {
  return (
    <Tabs defaultValue="preferences">
      <TabsList>
        <TabsTrigger value="preferences">Preferences</TabsTrigger>
        <TabsTrigger value="priority">Priority</TabsTrigger>
        <TabsTrigger value="bonuses">Bonuses & Penalties</TabsTrigger>
      </TabsList>

      <TabsContent value="preferences">
        <Card>
          <CardHeader>
            <CardTitle>Preference Weights</CardTitle>
            <CardDescription>
              How much each room attribute matters to residents. Higher weight = more influence on final score.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-industrial-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-100">Weight</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-100">Default</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-100">Description</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-muted-foreground">
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-3 px-4 font-mono text-warning">size</td>
                    <td className="py-3 px-4"><Badge>4</Badge></td>
                    <td className="py-3 px-4">Room size in square meters</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-3 px-4 font-mono text-warning">bedType</td>
                    <td className="py-3 px-4"><Badge>5</Badge></td>
                    <td className="py-3 px-4">Preference for double vs single bed</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-3 px-4 font-mono text-warning">attractiveness</td>
                    <td className="py-3 px-4"><Badge>3</Badge></td>
                    <td className="py-3 px-4">Overall room appeal (0-10 scale)</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-3 px-4 font-mono text-warning">quiet</td>
                    <td className="py-3 px-4"><Badge>3</Badge></td>
                    <td className="py-3 px-4">Inverse of noise level</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-3 px-4 font-mono text-warning">windows</td>
                    <td className="py-3 px-4"><Badge>2</Badge></td>
                    <td className="py-3 px-4">Number of windows</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-3 px-4 font-mono text-warning">sunlight</td>
                    <td className="py-3 px-4"><Badge>2</Badge></td>
                    <td className="py-3 px-4">Natural light level</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-3 px-4 font-mono text-warning">storage</td>
                    <td className="py-3 px-4"><Badge>2</Badge></td>
                    <td className="py-3 px-4">Storage space available</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-3 px-4 font-mono text-warning">kitchenProximity</td>
                    <td className="py-3 px-4"><Badge>2</Badge></td>
                    <td className="py-3 px-4">Closeness to kitchen</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-3 px-4 font-mono text-warning">ensuite</td>
                    <td className="py-3 px-4"><Badge>2</Badge></td>
                    <td className="py-3 px-4">Private bathroom attached</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-mono text-warning">floor</td>
                    <td className="py-3 px-4"><Badge>2</Badge></td>
                    <td className="py-3 px-4">Preference for upper floors</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="priority">
        <Card>
          <CardHeader>
            <CardTitle>Priority Weights</CardTitle>
            <CardDescription>
              Contribution-based priority scoring. People who helped find and secure the house get priority.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="industrial-card p-6 text-center">
                <div className="text-3xl font-bold text-warning font-mono mb-2">6</div>
                <div className="text-sm font-medium text-gray-100 mb-1">Found House</div>
                <div className="text-xs text-muted-foreground">Found the listing</div>
              </div>
              <div className="industrial-card p-6 text-center">
                <div className="text-3xl font-bold text-orange-400 font-mono mb-2">4</div>
                <div className="text-sm font-medium text-gray-100 mb-1">Handled Agent</div>
                <div className="text-xs text-muted-foreground">Dealt with letting agent</div>
              </div>
              <div className="industrial-card p-6 text-center">
                <div className="text-3xl font-bold text-emerald-400 font-mono mb-2">2</div>
                <div className="text-sm font-medium text-gray-100 mb-1">Attended Viewing</div>
                <div className="text-xs text-muted-foreground">Attended viewings</div>
              </div>
            </div>

            <div className="industrial-card p-6">
              <h4 className="font-semibold text-gray-100 mb-4">Priority Calculation</h4>
              <div className="code-block p-4 mb-4">
                <code className="text-sm">
                  <span className="text-purple-400">priorityScore</span> = <span className="text-warning">foundHouse</span> + <span className="text-orange-400">handledAgent</span> + <span className="text-emerald-400">attendedViewing</span><br/>
                  <span className="text-purple-400">multiplier</span> = 1 + (<span className="text-warning">priorityScore</span> / <span className="text-orange-400">priorityScale</span>)
                </code>
              </div>
              <p className="text-sm text-muted-foreground">
                With default <code className="text-warning">priorityScale = 10</code>, someone who did everything 
                gets a multiplier of <code className="text-orange-400">1 + 12/10 = 2.2×</code>
              </p>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold text-gray-100 mb-4">Priority Modes</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="industrial-card p-4">
                  <h5 className="text-warning font-medium mb-2">Amplify Mode</h5>
                  <p className="text-xs text-muted-foreground">
                    Multiplies entire score (preferences + bonuses - penalties). 
                    High priority amplifies both good and bad.
                  </p>
                </div>
                <div className="industrial-card p-4">
                  <h5 className="text-orange-400 font-medium mb-2">Bonus Mode</h5>
                  <p className="text-xs text-muted-foreground">
                    Only multiplies preferences and bonuses. Penalties remain constant. 
                    Treats priority as a tiebreaker.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="bonuses">
        <Card>
          <CardHeader>
            <CardTitle>Bonuses & Penalties</CardTitle>
            <CardDescription>
              Special adjustments for specific situations like couples, bed types, and safety concerns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <h4 className="font-semibold text-gray-100 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-emerald-400"></span>
              Bonuses
            </h4>
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="industrial-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-100">Bed Upgrade</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-transparent">+2.5</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently has single bed, prefers double, and room has double bed.
                </p>
              </div>
              <div className="industrial-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-100">External Partner</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-transparent">+3</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Has external partner and room has a double bed.
                </p>
              </div>
              <div className="industrial-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-100">Internal Couple (Double)</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-transparent">+5</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  First partner of internal couple gets shared double bed.
                </p>
              </div>
              <div className="industrial-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-100">Internal Couple (Single)</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-transparent">+4</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Second partner takes single, freeing double for others.
                </p>
              </div>
            </div>

            <h4 className="font-semibold text-gray-100 mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-red-400"></span>
              Penalties
            </h4>
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="industrial-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-100">Bed Downgrade</span>
                  <Badge className="bg-destructive/20 text-destructive-foreground border-transparent">-3</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently has double bed but room only has single.
                </p>
              </div>
              <div className="industrial-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-100">Safety Concern</span>
                  <Badge className="bg-destructive/20 text-destructive-foreground border-transparent">-4 × risk</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Applied when resident has safety concerns about ground/front rooms.
                </p>
              </div>
            </div>

            <h4 className="font-semibold text-gray-100 mb-4">Safety Risk Matrix</h4>
            <SafetyMatrix />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
