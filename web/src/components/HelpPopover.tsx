import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Separator } from './ui/separator';

export default function HelpPopover() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Open help" title="Help">
          <HelpCircle />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Game Help</DialogTitle>
          <DialogDescription>
            Quick controls and symbols for Battleships.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <h3 className="font-semibold">Keyboard</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li><span className="font-medium text-foreground">Tab</span>: Move across grid cells</li>
              <li><span className="font-medium text-foreground">Enter</span>: Place or fire on the focused cell</li>
              <li><span className="font-medium text-foreground">Space</span>: Rotate ship during placement</li>
            </ul>
          </div>
          <Separator />
          <div className="space-y-2">
            <h3 className="font-semibold">Legend</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li><span className="font-medium text-foreground">Hit</span>: marked with an explosion</li>
              <li><span className="font-medium text-foreground">Miss</span>: marked with a water drop</li>
              <li><span className="font-medium text-foreground">Sunk</span>: highlighted with a stronger outline</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
