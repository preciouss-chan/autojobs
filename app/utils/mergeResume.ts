import { compareTwoStrings } from "string-similarity";
import type { Resume, Project, Experience } from "@/app/lib/schemas";

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
function findBestMatch<T extends Project | Experience>(
  items: T[],
  searchValue: string,
  keyProperty: keyof T,
  similarityThreshold: number = 0.7
): T | null {
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
    const itemValue = String(item[keyProperty] || "").toLowerCase().trim();
    
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
export function mergeResume(baseResume: Resume, edits: Record<string, unknown>): Resume {
  const updatedResume = structuredClone(baseResume);

  // Type guard for edits
  const editsTyped = edits as {
    updated_summary?: string;
    project_edits?: Record<string, string[]>;
    experience_edits?: Record<string, string[]>;
    skills_to_add?: Record<string, string[]>;
  };

  // 1. Merge updated summary
  if (editsTyped.updated_summary && editsTyped.updated_summary.trim() !== "") {
    updatedResume.summary = editsTyped.updated_summary;
  }

  // 2. Merge project edits with fuzzy matching
  if (editsTyped.project_edits) {
    for (const [projectName, newBullets] of Object.entries(
      editsTyped.project_edits
    )) {
      // Use fuzzy matching to find the best matching project
      const project = findBestMatch<Project>(
        updatedResume.projects as Project[],
        projectName,
        "name" as keyof Project,
        0.65
      );

      if (project && Array.isArray(newBullets) && newBullets.length > 0) {
        project.bullets = newBullets;
      }
    }
  }

  // 3. Merge experience edits with fuzzy matching
  if (editsTyped.experience_edits) {
    for (const [companyName, newBullets] of Object.entries(
      editsTyped.experience_edits
    )) {
      // Use fuzzy matching to find the best matching company
      const exp = findBestMatch<Experience>(
        updatedResume.experience as Experience[],
        companyName,
        "company" as keyof Experience,
        0.65
      );

      if (exp && Array.isArray(newBullets) && newBullets.length > 0) {
        exp.bullets = newBullets;
      }
    }
  }

  // 4. Merge skills additions
  if (editsTyped.skills_to_add) {
    const skillSections = ["languages", "frameworks_libraries", "tools", "professional_skills"] as const;

    for (const section of skillSections) {
      if (editsTyped.skills_to_add[section]) {
        const newSkills = editsTyped.skills_to_add[section];

        for (const skill of newSkills) {
          // Check if skill already exists (case-insensitive)
          const skillExists = (updatedResume.skills[section] as string[]).some(
            (s: string) => s.toLowerCase() === skill.toLowerCase()
          );

          if (!skillExists) {
            (updatedResume.skills[section] as string[]).push(skill);
          }
        }
      }
    }
  }

  return updatedResume;
}
