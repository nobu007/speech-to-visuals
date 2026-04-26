describe('TASK-0001: Environment Setup', () => {
  test('Jest test runner works correctly', () => {
    expect(1 + 1).toBe(2);
  });

  test('TypeScript strict compilation works', () => {
    const greeting: string = 'Hello, speech-to-visuals!';
    expect(greeting).toBe('Hello, speech-to-visuals!');
  });
});
