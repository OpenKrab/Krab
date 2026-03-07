// ============================================================
// 🦀 Krab — Banner Taglines Collection
// ============================================================

export interface TaglineCollection {
  default: string[];
  minimal: string[];
  professional: string[];
  playful: string[];
  tech: string[];
}

export const taglines: TaglineCollection = {
  default: [
    "The lighter, smarter cousin",
    "Fast, flexible, and powerful", 
    "AI made simple",
    "Your intelligent assistant",
    "Simplify complexity",
    "Smart automation",
    "Effortless intelligence",
    "Powerful simplicity",
    "Your AI partner",
    "Intelligent by design",
    "Ship first, overthink later",
    "Less talk, more output",
    "If it works, it ships"
  ],
  
  minimal: [
    "Simple.",
    "Fast.",
    "Smart.",
    "Clean.",
    "Pure.",
    "Efficient."
  ],
  
  professional: [
    "Enterprise-grade intelligence",
    "Scalable AI solutions",
    "Professional automation",
    "Business intelligence",
    "Corporate AI platform",
    "Reliable performance",
    "Secure by design",
    "Trusted by enterprises"
  ],
  
  playful: [
    "AI with a smile!",
    "Your happy AI companion",
    "Intelligence + Joy",
    "Smart and cheerful",
    "Fun with AI",
    "Your AI friend",
    "Making AI fun!",
    "Playful intelligence",
    "Works on my machine, trust me",
    "Bug? That's a surprise feature",
    "Coffee in, solutions out",
    "Chaos in, clean output out",
    "Your drama-free code buddy"
  ],
  
  tech: [
    "AI evolution",
    "Next-generation intelligence",
    "Future-ready AI",
    "Advanced automation",
    "Cutting-edge AI",
    "Innovation driven",
    "Tech-forward thinking",
    "Digital transformation"
  ]
};

// Helper functions
export function getRandomTagline(theme: keyof TaglineCollection = "default"): string {
  const collection = taglines[theme];
  return collection[Math.floor(Math.random() * collection.length)];
}

export function getAllTaglines(): string[] {
  return Object.values(taglines).flat();
}

export function getTaglinesByTheme(theme: keyof TaglineCollection): string[] {
  return taglines[theme];
}

export function addTagline(theme: keyof TaglineCollection, tagline: string): void {
  taglines[theme].push(tagline);
}

export function removeTagline(theme: keyof TaglineCollection, tagline: string): boolean {
  const index = taglines[theme].indexOf(tagline);
  if (index > -1) {
    taglines[theme].splice(index, 1);
    return true;
  }
  return false;
}

// Export for dynamic loading
export default taglines;
