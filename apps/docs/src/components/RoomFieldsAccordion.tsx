import * as React from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/accordion';

export function RoomFieldsAccordion() {
  return (
    <Accordion type="single" collapsible className="mt-6">
      <AccordionItem value="room-fields">
        <AccordionTrigger>Room Field Reference</AccordionTrigger>
        <AccordionContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><code className="text-warning">id</code> - Unique identifier (string)</li>
            <li><code className="text-warning">name</code> - Human-readable name</li>
            <li><code className="text-warning">sizeSqm</code> - Square meters (number)</li>
            <li><code className="text-warning">windows</code> - Window count (number)</li>
            <li><code className="text-warning">attractiveness</code> - 0-10 appeal score</li>
            <li><code className="text-warning">bedType</code> - "single" or "double"</li>
            <li><code className="text-warning">floor</code> - 0 = ground, 1 = first, etc.</li>
            <li><code className="text-warning">isFrontFacing</code> - Faces street (boolean)</li>
            <li><code className="text-warning">noise</code> - 0-10 noise level</li>
            <li><code className="text-warning">storage</code> - 0-10 storage space</li>
            <li><code className="text-warning">sunlight</code> - 0-10 natural light</li>
            <li><code className="text-warning">nearKitchen</code> - Close to kitchen (boolean)</li>
            <li><code className="text-warning">ensuite</code> - Has private bathroom (boolean)</li>
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
