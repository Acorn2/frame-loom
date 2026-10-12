import styleIndex from '../../styles/style-index.json';

// A recipe's orientations and the selected style's canvas declaration both apply.
export function compatibleCanvases(recipe: {styles: readonly string[]; orientations?: readonly string[]}, style: string): string[] {
  const pack = styleIndex.styles.find(item => item.id === style);
  return recipe.styles.includes(style) && pack ? (recipe.orientations ?? ['landscape']).filter(canvas => pack.canvas.includes(canvas)) : [];
}
