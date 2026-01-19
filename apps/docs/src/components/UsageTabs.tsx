import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { CodeBlock } from './CodeBlock';

const geminiHighCode = `# Use Gemini AI scoring with high thinking level
bun run assign --mode gemini --gemini-thinking high`;

const ignorePrefsCode = `# Ignore kitchen proximity and floor preferences
bun run assign --ignore kitchenProximity --ignore floor`;

const jsonOutputCode = `# Get JSON output for further processing
bun run assign --json > results.json`;

const rightmoveCode = `bun run rightmove --url "https://www.rightmove.co.uk/properties/123456" --out data/house.json`;

const residentsCode = `bun run residents --out data/people.json`;

export function UsageTabs() {
  return (
    <Tabs defaultValue="assign">
      <TabsList>
        <TabsTrigger value="assign">assign</TabsTrigger>
        <TabsTrigger value="rightmove">rightmove</TabsTrigger>
        <TabsTrigger value="residents">residents</TabsTrigger>
      </TabsList>

      <TabsContent value="assign">
        <Card>
          <CardHeader>
            <CardTitle>bun run assign</CardTitle>
            <CardDescription>
              Run the room assignment algorithm with your configuration files.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <h4 className="font-semibold text-gray-100 mb-3">Basic Usage</h4>
            <CodeBlock 
              code="bun run assign --house data/house.json --people data/people.json"
              language="bash"
            />

            <h4 className="font-semibold text-gray-100 mb-3 mt-6">All Options</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-industrial-border">
                    <th className="text-left py-2 px-3 text-gray-100">Flag</th>
                    <th className="text-left py-2 px-3 text-gray-100">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--house &lt;path&gt;</td>
                    <td className="py-2 px-3">Path to house configuration JSON</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--people &lt;path&gt;</td>
                    <td className="py-2 px-3">Path to people configuration JSON</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--mode</td>
                    <td className="py-2 px-3">Scoring mode: <code>deterministic</code> or <code>gemini</code></td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--priority-mode</td>
                    <td className="py-2 px-3">Priority mode: <code>amplify</code> or <code>bonus</code></td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--json</td>
                    <td className="py-2 px-3">Output machine-readable JSON</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--ignore &lt;key&gt;</td>
                    <td className="py-2 px-3">Skip scoring factor (repeatable)</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--gemini-questions</td>
                    <td className="py-2 px-3">Allow Gemini to ask clarifying questions</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--gemini-thinking</td>
                    <td className="py-2 px-3">Thinking level: none, low, medium, high</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--gemini-model</td>
                    <td className="py-2 px-3">Override Gemini model name</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--gemini-data</td>
                    <td className="py-2 px-3">Attach data files (repeatable)</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--gemini-webpage</td>
                    <td className="py-2 px-3">Attach URLs (repeatable)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-warning">--gemini-image</td>
                    <td className="py-2 px-3">Attach image files (repeatable)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="font-semibold text-gray-100 mb-3 mt-6">Examples</h4>
            <div className="space-y-4">
              <CodeBlock code={geminiHighCode} language="bash" />
              <CodeBlock code={ignorePrefsCode} language="bash" />
              <CodeBlock code={jsonOutputCode} language="bash" />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="rightmove">
        <Card>
          <CardHeader>
            <CardTitle>bun run rightmove</CardTitle>
            <CardDescription>
              Generate house configuration from a Rightmove listing using Gemini AI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <h4 className="font-semibold text-gray-100 mb-3">Basic Usage</h4>
            <CodeBlock code={rightmoveCode} language="bash" />

            <div className="blueprint-card p-4 mt-4 mb-6">
              <p className="text-sm text-orange-400">
                <strong>Requires:</strong> <code className="text-warning">GEMINI_API_KEY</code> environment variable
              </p>
            </div>

            <h4 className="font-semibold text-gray-100 mb-3">Options</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-industrial-border">
                    <th className="text-left py-2 px-3 text-gray-100">Flag</th>
                    <th className="text-left py-2 px-3 text-gray-100">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--url &lt;url&gt;</td>
                    <td className="py-2 px-3">Rightmove property listing URL</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--out &lt;path&gt;</td>
                    <td className="py-2 px-3">Output file path for house.json</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--model &lt;name&gt;</td>
                    <td className="py-2 px-3">Override Gemini model</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--max-images</td>
                    <td className="py-2 px-3">Limit inline listing photos</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-warning">--max-floorplans</td>
                    <td className="py-2 px-3">Limit inline floorplan images</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="residents">
        <Card>
          <CardHeader>
            <CardTitle>bun run residents</CardTitle>
            <CardDescription>
              Interactive CLI to generate people configuration with guided prompts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <h4 className="font-semibold text-gray-100 mb-3">Basic Usage</h4>
            <CodeBlock code={residentsCode} language="bash" />

            <h4 className="font-semibold text-gray-100 mb-3 mt-6">Options</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-industrial-border">
                    <th className="text-left py-2 px-3 text-gray-100">Flag</th>
                    <th className="text-left py-2 px-3 text-gray-100">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--out &lt;path&gt;</td>
                    <td className="py-2 px-3">Output file path for people.json</td>
                  </tr>
                  <tr className="border-b border-industrial-border/50">
                    <td className="py-2 px-3 font-mono text-warning">--defaults &lt;path&gt;</td>
                    <td className="py-2 px-3">Load defaults from existing file</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-warning">--count &lt;n&gt;</td>
                    <td className="py-2 px-3">Pre-set number of residents</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              The interactive prompts will guide you through entering each resident's 
              information including preferences, priorities, and relationship status.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
