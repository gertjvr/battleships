import React from 'react';
import { Bot, Monitor, Users } from 'lucide-react';
import type { Difficulty } from '../persistence';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

interface Props {
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  onNavigate: (path: string) => void;
}

export default function HomeView({ difficulty, onDifficultyChange, onNavigate }: Props) {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md items-start px-4 py-6 sm:items-center">
      <Card className="w-full rounded-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-extrabold tracking-tight">Kids Battleships</CardTitle>
          <CardDescription>Choose how you want to play.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button size="lg" className="w-full justify-start" onClick={() => onNavigate('/pvp')}>
            <Users />
            Player vs Player
          </Button>

          <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
            <Button size="lg" className="justify-start" onClick={() => onNavigate('/pvc')}>
              <Bot />
              Player vs Computer
            </Button>
            <Select value={difficulty} onValueChange={(value) => onDifficultyChange(value as Difficulty)}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue aria-label={difficulty} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button size="lg" className="w-full justify-start" onClick={() => onNavigate('/online')}>
            <Monitor />
            Online
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
