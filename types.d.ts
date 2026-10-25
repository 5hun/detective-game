type Level = 'easy' | 'normal' | 'hard';
type StatementType = 'single' | 'same' | 'count' | 'any' | 'both' | 'parity' | 'ordered' | 'majority' | 'allSame' | 'balance';
interface Person { id: string; name: string; rule: string; type: StatementType }
type Statement =
  | { type: 'balance'; targets: number[]; value: number }
  | { type: 'count'; targets: number[]; value: number }
  | { type: Exclude<StatementType, 'count' | 'balance'>; targets: number[]; value: boolean };
interface Puzzle { round: number; seed: number; level: Level; k: number; mistakenCount: number; mistaken: number | null; people: Person[]; statements: Statement[]; testimonyCosts: number[]; answer: boolean[] }
interface Resolution { reward?: number; correct: boolean; guess: true }
interface JudgmentState { revealed: boolean[]; puzzle: Puzzle; resolved: (Resolution | null)[]; trust: number; status: 'playing' | 'won' | 'lost' }
interface GameState extends JudgmentState { version: number; startingTrust: number; storyHistory: number[]; notes: string[]; markers: number[] }
interface Window { DetectiveEngine: typeof DetectiveEngine; portrait: typeof portrait; addReadings: typeof addReadings; judgmentSound: typeof judgmentSound; webkitAudioContext?: typeof AudioContext; playedTones: number[]; playedRecordings: string[] }
declare var portrait: (id: string, extra?: string, state?: 'neutral' | 'good' | 'liar' | 'sad') => string;
declare var addReadings: (root?: HTMLElement) => void;
declare var judgmentSound: { play(correct: boolean): Promise<void>; testimony(): Promise<void>; stamp(celebrate?: boolean): Promise<void>; stop(): void };
