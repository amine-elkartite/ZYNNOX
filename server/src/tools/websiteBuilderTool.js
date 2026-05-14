export const websiteBuilderTool = {
  id: "website-builder",
  name: "Website Builder",
  description: "Tool descriptor for generating website projects.",
  creditCost: "10-30",
  async execute({ prompt, type, style }) {
    return { prompt, type, style, note: "Website generation is executed through websiteBuilderService to coordinate credits and persistence." };
  }
};
