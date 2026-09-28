export const TEMPLATE_FAMILY_IDS = [
  'retro-zine',
  'signal',
  'scatterbrain',
  'archive-grid',
  'signal-noir',
  'studio-frame'
] as const;

export type TemplateFamilyId = (typeof TEMPLATE_FAMILY_IDS)[number];

export function isTemplateFamily(id: string): id is TemplateFamilyId {
  return TEMPLATE_FAMILY_IDS.some((candidate) => candidate === id);
}
