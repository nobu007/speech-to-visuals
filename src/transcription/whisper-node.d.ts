// Ambient declaration for the untyped 'whisper-node' dependency.
// Lives in a .d.ts (not inline `declare module` inside a module file, which
// TS rejects as an invalid augmentation for an untyped module — TS2665).
// Behavior identical to the previous inline declaration (verbatim move).
declare module 'whisper-node' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Whisper: any;
  export default Whisper;
}
