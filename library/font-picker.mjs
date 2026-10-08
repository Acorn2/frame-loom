/* global document, FontFace */

export function createFontPicker(container, catalog, onChange) {
  if (!container) return {render() {}};
  const loaded = new Map();
  function load(font) {
    if (!loaded.has(font.id)) {
      const face = font.faces[0];
      loaded.set(font.id, new FontFace(font.family, `url("${face.file}") format("${face.format}")`, {weight: face.weight}).load().then(value => {
        document.fonts.add(value);
      }));
    }
    return loaded.get(font.id);
  }
  const cards = catalog.fonts.map(font => {
    const card = document.createElement('label'); card.className = 'font-card';
    const input = document.createElement('input'); input.type = 'radio'; input.name = 'project-font'; input.value = font.id;
    const body = document.createElement('span'); body.className = 'font-card-body';
    const header = document.createElement('span'); header.className = 'font-card-heading';
    const name = document.createElement('strong'); name.textContent = font.name;
    const tag = document.createElement('span'); tag.className = 'font-category'; tag.textContent = font.category;
    header.append(name, tag);
    const sample = document.createElement('span'); sample.className = 'font-sample'; sample.textContent = '把材料变成可检查的画面'; sample.hidden = true;
    const status = document.createElement('span'); status.className = 'font-loading'; status.textContent = '正在加载字体示例…';
    const description = document.createElement('span'); description.className = 'font-description'; description.textContent = font.description;
    body.append(header, sample, status, description); card.append(input, body); container.append(card);
    load(font).then(() => {sample.style.fontFamily = `"${font.family}"`; sample.hidden = false; status.hidden = true;}).catch(() => {
      status.textContent = '字体文件加载失败，请刷新重试'; status.classList.add('error'); input.disabled = true;
    });
    input.addEventListener('change', () => {if (input.checked) onChange(font.id);});
    return input;
  });
  return {render(state) {for (const card of cards) card.checked = card.value === state.font;}};
}
