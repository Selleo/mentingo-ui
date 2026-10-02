export type AgentVisualizerState =
  | "disconnected"
  | "connecting"
  | "initializing"
  | "pre-connect-buffering"
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "failed";
