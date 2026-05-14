export const projectStructureTool = {
  id: "project-structure",
  name: "Project Structure",
  description: "Return a normalized project structure description for generated or existing projects.",
  creditCost: 0,
  async execute({ structure }) {
    return {
      structure,
      conventions: ["server/src for backend code", "client/src for frontend code", "docs for operating guides"]
    };
  }
};
