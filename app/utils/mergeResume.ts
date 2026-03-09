import { compareTwoStrings } from "string-similarity";

/**
 * Find the best matching item from a list using fuzzy matching
 * Combines string similarity with prefix/word-boundary matching
 * 
 * @param items - Array of items to search through
 * @param searchValue - The value to search for
 * @param keyProperty - The property on each item to compare against
 * @param similarityThreshold - Minimum similarity score (0-1) to consider a match
 * @returns The best matching item or null if no match above threshold
 */
function findBestMatch(
  items: any[],
  searchValue: string,
  keyProperty: string,
  similarityThreshold: number = 0.7
): any | null {
  if (!items || items.length === 0) {
    return null;
  }

  const searchValueLower = searchValue.toLowerCase().trim();
  
  // Return null for empty or whitespace-only search values
  if (!searchValueLower) {
    return null;
  }
  
  // Calculate similarity scores for all items
  const scores = items.map((item, index) => {
    const itemValue = (item[keyProperty] || "").toLowerCase().trim();
    
    // Base similarity score from string-similarity
    let similarity = compareTwoStrings(itemValue, searchValueLower);
    
    // Bonus: if one string starts with the words of the other
    // This helps match "google" with "google inc" 
    const searchStartsWithItem = searchValueLower.startsWith(itemValue);
    const itemStartsWithSearch = itemValue.startsWith(searchValueLower);
    const isPrefix = searchStartsWithItem || itemStartsWithSearch;
    
    if (isPrefix) {
      // If one is a prefix of the other, boost the score
      similarity = Math.max(similarity, 0.75);
    }
    
    return { item, index, similarity };
  });

  // Find the best match
  const bestMatch = scores.sort((a, b) => b.similarity - a.similarity)[0];

  // Only return if similarity is above threshold
  if (bestMatch && bestMatch.similarity >= similarityThreshold) {
    return bestMatch.item;
  }

  return null;
}

/**
 * Merge tailored resume edits with the base resume
 * Uses fuzzy matching to handle variations in project/company names
 * 
 * @param baseResume - The original parsed resume
 * @param edits - The tailored edits from the AI
 * @returns Updated resume with edits applied
 */
export function mergeResume(baseResume: any, edits: any): any {
  const updatedResume = structuredClone(baseResume);

  // 1. Merge updated summary
  if (edits.updated_summary && edits.updated_summary.trim() !== "") {
    updatedResume.summary = edits.updated_summary;
  }

  // 2. Merge project edits with fuzzy matching
  if (edits.project_edits) {
    for (const [projectName, newBullets] of Object.entries(
      edits.project_edits
    )) {
      // Use fuzzy matching to find the best matching project
      // Threshold of 0.65 (65%) allows for:
      // - Capitalization differences: "E-Commerce Platform" vs "E-commerce platform"
      // - Minor additions: "React Dashboard" vs "React Dashboard App"
      // - Single character typos: "Gogle" vs "Google"
      // Edge cases (like multiple typos in short names) will be skipped
      const project = findBestMatch(
        updatedResume.projects,
        projectName as string,
        "name",
        0.65
      );

      if (project && Array.isArray(newBullets) && newBullets.length > 0) {
        project.bullets = newBullets;
      }
    }
  }

  // 3. Merge experience edits with fuzzy matching
  if (edits.experience_edits) {
    for (const [companyName, newBullets] of Object.entries(
      edits.experience_edits
    )) {
      // Use fuzzy matching to find the best matching company
      // Threshold of 0.65 (65%) allows for variations like:
      // - "Google" vs "Google Inc" (prefix matching with 0.75 bonus)
      // - "Microsoft" vs "Microsoft Corporation" (prefix matching with 0.75 bonus)
      // - "TechCorp" vs "TechCorp Inc." (minor additions)
      // - Typos with single character errors: "Microsft" vs "Microsoft"
      const exp = findBestMatch(
        updatedResume.experience,
        companyName as string,
        "company",
        0.65
      );

      if (exp && Array.isArray(newBullets) && newBullets.length > 0) {
        exp.bullets = newBullets;
      }
    }
  }

  // 4. Merge skills additions
  if (edits.skills_to_add) {
    const skillSections = ["languages", "frameworks_libraries", "tools"];

    for (const section of skillSections) {
      if (edits.skills_to_add[section]) {
        const newSkills: string[] = edits.skills_to_add[section];

        for (const skill of newSkills) {
          // Check if skill already exists (case-insensitive)
          const skillExists = updatedResume.skills[section].some(
            (s: string) => s.toLowerCase() === skill.toLowerCase()
          );

          if (!skillExists) {
            updatedResume.skills[section].push(skill);
          }
        }
      }
    }
  }

  return updatedResume;
}
