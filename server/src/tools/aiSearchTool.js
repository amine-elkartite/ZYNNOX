export const aiSearchTool = {
  id: "ai-search",
  name: "AI Search",
  description: "Tool descriptor for AI Search research sessions.",
  creditCost: "3-8",
  async execute({ query, depth }) {
    return { query, depth, note: "AI Search is executed through aiSearchService to coordinate credits and persistence." };
  }
};
