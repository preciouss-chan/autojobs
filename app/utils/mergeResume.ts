export function mergeResume(baseResume: any, edits: any) {
  const updatedResume = structuredClone(baseResume);

  // 1. Merge updated summary
  if (edits.updated_summary && edits.updated_summary.trim() !== "") {
    updatedResume.summary = edits.updated_summary;
  }

  // 2. Merge project edits
  if (edits.project_edits) {
    for (const [projectName, newBullets] of Object.entries(
      edits.project_edits
    )) {
      const project = updatedResume.projects.find(
        (p: any) => p.name.toLowerCase() === projectName.toLowerCase()
      );

      if (project && newBullets.length > 0) {
        project.bullets = newBullets;
      }
    }
  }

  // 3. Merge experience edits
  if (edits.experience_edits) {
    for (const [companyName, newBullets] of Object.entries(
      edits.experience_edits
    )) {
      const exp = updatedResume.experience.find(
        (e: any) => e.company.toLowerCase() === companyName.toLowerCase()
      );

      if (exp && newBullets.length > 0) {
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
          if (!updatedResume.skills[section].includes(skill)) {
            updatedResume.skills[section].push(skill);
          }
        }
      }
    }
  }

  return updatedResume;
}

