type Level = 'easy' | 'normal' | 'hard';
type StatementType = 'single' | 'same' | 'count' | 'any' | 'both' | 'parity' | 'ordered' | 'majority';
interface Person { id: string; name: string; job: string; rule: string; type: StatementType }
type Statement =
  | { type: 'count'; targets: number[]; value: number }
  | { type: Exclude<StatementType, 'count'>; targets: number[]; value: boolean };
interface Puzzle { seed: number; level: Level; k: number; people: Person[]; statements: Statement[]; answer: boolean[] }
interface Resolution { correct: boolean; guess: true }
interface JudgmentState { puzzle: Puzzle; resolved: (Resolution | null)[]; trust: number; status: 'playing' | 'won' | 'lost' }
interface GameState extends JudgmentState { version: number; notes: string[]; markers: number[]; revealed: boolean[] }
interface Window { DetectiveEngine: typeof DetectiveEngine; portrait: typeof portrait; addReadings: typeof addReadings; judgmentSound: typeof judgmentSound; webkitAudioContext?: typeof AudioContext; playedTones: number[] }
declare var portrait: (id: string, extra?: string, state?: 'neutral' | 'good' | 'liar' | 'sad') => string;
declare var addReadings: (root?: HTMLElement) => void;
declare var judgmentSound: { play(correct: boolean): Promise<void>; testimony(): Promise<void>; stop(): void };
