# Team Avatar Generator - DALL-E Prompt Template

## Base Prompt Structure

Create a professional, abstract team avatar icon for a team called "{{teamName}}" that focuses on {{teamPurpose}}.

**Style Requirements:**
- Minimalist and modern design
- Professional and corporate appropriate
- Abstract representation (not literal/photographic)
- Clean, recognizable shapes
- Suitable as a small icon (will be displayed at 128px)
- No text or letters in the image
- Centered composition with balanced negative space

**Visual Style:**
{{styleVariation}}

**Color Palette:**
- Use 2-4 harmonious colors
- Professional color combinations
- Avoid harsh neon or overly bright colors
- Consider the team's purpose when choosing colors

**Technical Specifications:**
- Square composition (1:1 aspect ratio)
- Icon should occupy ~70% of canvas
- Leave margin around edges
- High contrast for visibility at small sizes
- Clean edges and shapes

---

## Style Variations (styleIndex 0-8)

### Style 0: Geometric Abstract
Modern geometric shapes with clean lines, overlapping forms, subtle depth through layering.

### Style 1: Fluid Organic
Flowing organic shapes, smooth curves, natural forms, soft gradients between shapes.

### Style 2: Tech/Digital
Circuit-inspired patterns, connected nodes, digital aesthetic, sharp angles and lines.

### Style 3: Minimalist Solid
Ultra-simple solid shapes, maximum 3 elements, bold colors, strong negative space.

### Style 4: Symbolic/Metaphoric
Abstract symbols representing teamwork, growth, or the team's purpose, iconic style.

### Style 5: Gradient Mesh
Smooth color transitions, mesh gradients, modern app-style aesthetic, soft and approachable.

### Style 6: Line Art
Elegant continuous line work, stroke-based design, monochromatic or duo-tone.

### Style 7: Isometric 3D
Flat 3D isometric perspective, geometric building blocks, modern and structured.

### Style 8: Nature-Inspired Abstract
Natural elements abstracted into geometric forms (leaves, waves, mountains), organic but clean.

---

## Example Prompts

### Engineering Team
"Create a professional, abstract team avatar icon for a team called 'Platform Engineering' that focuses on building scalable infrastructure and developer tools. Style: Geometric Abstract - modern geometric shapes with clean lines, overlapping forms creating a sense of structure and interconnection. Use a tech-focused color palette with deep blues, teals, and silver grays. Icon should be minimalist, suitable at small sizes, centered with balanced negative space. No text."

### Design Team
"Create a professional, abstract team avatar icon for a team called 'Product Design' that focuses on user experience and visual design. Style: Fluid Organic - flowing organic shapes with smooth curves and soft gradients representing creativity and user-centered thinking. Use a creative color palette with purples, soft pinks, and warm oranges. Icon should be modern, professional, suitable at small sizes, centered composition. No text."

### Sales Team
"Create a professional, abstract team avatar icon for a team called 'Enterprise Sales' that focuses on customer relationships and business growth. Style: Symbolic/Metaphoric - abstract symbols representing growth and connection, upward momentum, iconic style. Use a professional color palette with confident blues, energetic greens, and gold accents. Icon should be bold, recognizable, suitable at small sizes. No text."

---

## Prompt Generation Logic

```typescript
function generatePrompt(teamName: string, teamPurpose: string, styleIndex: number): string {
  const styles = [
    "Geometric Abstract - modern geometric shapes with clean lines, overlapping forms, subtle depth through layering",
    "Fluid Organic - flowing organic shapes, smooth curves, natural forms, soft gradients between shapes",
    "Tech/Digital - circuit-inspired patterns, connected nodes, digital aesthetic, sharp angles and lines",
    "Minimalist Solid - ultra-simple solid shapes, maximum 3 elements, bold colors, strong negative space",
    "Symbolic/Metaphoric - abstract symbols representing teamwork or the team's purpose, iconic style",
    "Gradient Mesh - smooth color transitions, mesh gradients, modern app-style aesthetic, soft and approachable",
    "Line Art - elegant continuous line work, stroke-based design, monochromatic or duo-tone",
    "Isometric 3D - flat 3D isometric perspective, geometric building blocks, modern and structured",
    "Nature-Inspired Abstract - natural elements abstracted into geometric forms, organic but clean"
  ];

  const styleVariation = styles[styleIndex % styles.length];

  return `Create a professional, abstract team avatar icon for a team called "${teamName}" that focuses on ${teamPurpose}.

Style: ${styleVariation}

Requirements:
- Minimalist and modern design
- Professional and corporate appropriate
- Abstract representation (not literal/photographic)
- Clean, recognizable shapes
- Suitable as a small icon (will be displayed at 128px)
- No text or letters in the image
- Centered composition with balanced negative space
- Use 2-4 harmonious colors appropriate for the team's purpose
- Icon should occupy ~70% of canvas with margin around edges
- High contrast for visibility at small sizes`;
}
```

---

## Notes

- This prompt is optimized for DALL-E 3 with 1024x1024 size
- Style variations ensure diversity when generating multiple avatars
- The system should call this agent 9 times with styleIndex 0-8 for variety
- Each generation costs $0.04 (DALL-E 3 standard quality)
- Images are stored in workspace service at: `/company/{companyId}/team-avatars/{teamId}/{timestamp}-{styleIndex}.png`
