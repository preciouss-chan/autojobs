/**
 * LLM Configuration Constants
 * Ensures consistent temperature and other settings across all OpenAI API calls
 */

export const LLM_CONFIG = {
  /**
   * Deterministic operations (parsing, extraction, structured output)
   * Lower temperature = more consistent, repeatable results
   * Use for: resume parsing, job requirement extraction
   */
  DETERMINISTIC: {
    temperature: 0.1,
    description: "For structured extraction and parsing tasks"
  },

  /**
   * Focused operations (tailoring, specific tasks with clear requirements)
   * Low-moderate temperature = good balance of consistency and naturalness
   * Use for: resume tailoring, targeted transformations
   */
  FOCUSED: {
    temperature: 0.3,
    description: "For focused tasks with clear requirements"
  },

  /**
   * Conversational operations (chat, Q&A)
   * Moderate temperature = natural conversation with some variation
   * Use for: application assistant chatbot
   */
  CONVERSATIONAL: {
    temperature: 0.4,
    description: "For conversational interactions"
  },

  /**
   * Creative operations (brainstorming, varied responses)
   * Higher temperature = more varied, creative responses
   * Use for: cover letter suggestions, creative content
   */
  CREATIVE: {
    temperature: 0.7,
    description: "For creative and varied responses"
  },

  /**
   * Default settings for all LLM operations
   */
  DEFAULTS: {
    model: "gpt-4o-mini",
    max_tokens: 600,
  },
} as const;

/**
 * Get LLM config for a specific operation type
 * @param operationType - Type of operation (DETERMINISTIC, FOCUSED, CONVERSATIONAL, CREATIVE)
 * @returns Temperature setting for that operation
 */
export function getLLMTemperature(
  operationType: keyof typeof LLM_CONFIG
): number {
  const config = LLM_CONFIG[operationType];
  
  // Check if config has temperature property (exclude DEFAULTS)
  if (config && typeof config === "object" && "temperature" in config) {
    return (config as { temperature: number }).temperature;
  }
  
  return LLM_CONFIG.FOCUSED.temperature;
}

/**
 * Validate that temperature is within OpenAI's allowed range (0-2)
 */
export function validateTemperature(temperature: number): boolean {
  return temperature >= 0 && temperature <= 2;
}
