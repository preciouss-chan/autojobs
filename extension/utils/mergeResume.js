export function mergeResume(baseResume, edits) {
  const updatedResume = structuredClone(baseResume);

  // 1. Merge updated summary
  if (edits.updated_summary && edits.updated_summary.trim() !== "") {
    updatedResume.summary = edits.updated_summary;
  }

  // 2. Merge project edits
  if (edits.project_edits) {
    for (const [projectName, newBullets] of Object.entries(edits.project_edits)) {
      const project = updatedResume.projects.find(
        (p) => p.name.toLowerCase() === projectName.toLowerCase()
      );
      if (project && newBullets.length > 0) {
        project.bullets = newBullets;
      }
    }
  }

  // 3. Merge experience edits
  if (edits.experience_edits) {
    for (const [companyName, newBullets] of Object.entries(edits.experience_edits)) {
      const exp = updatedResume.experience.find(
        (e) => e.company.toLowerCase() === companyName.toLowerCase()
      );
      if (exp && newBullets.length > 0) {
        exp.bullets = newBullets;
      }
    }
  }

  // 4. Merge skills additions
  if (edits.skills_to_add) {
    const sections = ["languages", "frameworks_libraries", "tools"];
    for (const section of sections) {
      if (edits.skills_to_add[section]) {
        const newSkills = edits.skills_to_add[section];
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

