/* global document, window, FontFace */

export function createFontPicker(container, catalog, onChange) {
  if (!container) return {render() {}};
  const cards = catalog.fonts.map(font => {
    const card = document.createElement('label'); card.className = 'font-card';
    const input = document.createElement('input'); input.type = 'radio'; input.name = 'project-font'; input.value = font.id;
    const body = document.createElement('span'); body.className = 'font-card-body';
    const header = document.createElement('span'); header.className = 'font-card-heading';
    const name = document.createElement('strong'); name.textContent = font.name;
    const tag = document.createElement('span'); tag.className = 'font-category'; tag.textContent = font.category;
    header.append(name, tag);
    const sample = document.createElement('span'); sample.className = 'font-sample'; sample.textContent = catalog.fontSampleText; sample.hidden = true;
    const status = document.createElement('span'); status.className = 'font-loading'; status.textContent = '字体示例即将显示';
    const description = document.createElement('span'); description.className = 'font-description'; description.textContent = font.description;
    body.append(header, sample, status, description); card.append(input, body); container.append(card);
    let started = false;
    function load() {
      if (started) return;
      started = true;
      status.textContent = '正在加载字体示例…';
      const face = font.sampleFace;
      new FontFace(font.family, `url("${face.file}") format("${face.format}")`).load().then(value => {
        document.fonts.add(value);
        sample.style.fontFamily = `"${font.family}"`; sample.hidden = false; status.hidden = true;
      }).catch(() => {
        status.textContent = '字体示例加载失败，仍可选择用于制作'; status.classList.add('error');
      });
    }
    input.addEventListener('change', () => {if (input.checked) {load(); onChange(font.id);}});
    return {input, card, load};
  });
  if (window.IntersectionObserver) {
    const observer = new window.IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {cards.find(item => item.card === entry.target)?.load(); observer.unobserve(entry.target);}
    }, {rootMargin: '160px 0px'});
    for (const item of cards) observer.observe(item.card);
  }
  return {render(state) {for (const item of cards) {item.input.checked = item.input.value === state.font; if (item.input.checked) item.load();}}};
}
