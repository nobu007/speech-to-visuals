/**
 * Mock factories for the Gemini API client.
 */

export interface MockGeminiResponse {
  text: string;
  candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
}

/**
 * Create a mock Gemini generateContent response.
 */
export function createMockGeminiResponse(
  text: string = 'Mock Gemini response',
): MockGeminiResponse {
  return {
    text,
    candidates: [
      {
        content: { parts: [{ text }] },
      },
    ],
  };
}

/**
 * Create a mock Gemini client with jest fns.
 */
export function createMockGeminiClient() {
  return {
    generateContent: vi.fn().mockResolvedValue(createMockGeminiResponse()),
    generateContentStream: vi.fn(),
    model: 'gemini-2.5-flash',
  };
}
