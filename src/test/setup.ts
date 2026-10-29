// Unit tests read the French texts (the app's first language): the machine's own language
// must not change them. English is checked where it matters, with `vi.resetModules`.
Object.defineProperty(globalThis, 'navigator', {
  value: { ...globalThis.navigator, language: 'fr-FR', languages: ['fr-FR'] },
  configurable: true,
});
