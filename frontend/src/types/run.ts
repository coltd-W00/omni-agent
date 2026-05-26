export interface Run {
  id: string;
  runNumber: number;
  input: string | null;
  exitCode: number | null;
  logPath: string | null;
  logTail: string | null;
  startedAt: string;
  endedAt: string | null;
}
