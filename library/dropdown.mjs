/* global document, window */
// Keep native select values and change events as the page's source of truth.
const controls = new Map();

function enhance(select) {
  const labels = [...select.labels];
  const wrapper = document.createElement('div');
  wrapper.className = `select-control${['tts-preset', 'color-mode'].includes(select.id) ? ' select-control--wide' : ''}`;
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.id = `${select.id}-trigger`; trigger.className = 'select-trigger';
  trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', `${select.id}-menu`);
  const value = document.createElement('span'); value.id = `${select.id}-value`;
  const arrow = document.createElement('span'); arrow.className = 'select-chevron'; arrow.setAttribute('aria-hidden', 'true');
  trigger.append(value, arrow);
  for (const label of labels) {
    label.id ||= `${select.id}-label`; label.htmlFor = trigger.id;
  }
  trigger.setAttribute('aria-labelledby', [...labels.map(label => label.id), value.id].join(' '));
  if (select.hasAttribute('aria-describedby')) trigger.setAttribute('aria-describedby', select.getAttribute('aria-describedby'));
  const menu = document.createElement('div');
  menu.id = `${select.id}-menu`; menu.className = 'select-menu'; menu.hidden = true;
  menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-labelledby', labels.map(label => label.id).join(' '));
  const options = [...select.options];
  const items = options.map((option, index) => {
    const item = document.createElement('div');
    item.id = `${select.id}-option-${index}`; item.className = 'select-option';
    item.setAttribute('role', 'option'); item.textContent = option.textContent;
    item.setAttribute('aria-disabled', String(option.disabled)); menu.append(item);
    item.addEventListener('pointermove', () => {if (!option.disabled) highlight(index);});
    item.addEventListener('click', () => choose(index));
    return item;
  });
  select.before(wrapper); wrapper.append(select, trigger, menu); select.hidden = true;
  let active = select.selectedIndex; let search = ''; let lastTyped = 0;

  function highlight(index) {
    active = index;
    items.forEach((item, position) => item.classList.toggle('is-active', position === index));
    trigger.setAttribute('aria-activedescendant', items[index].id);
    items[index].scrollIntoView({block: 'nearest'});
  }
  function close() {
    menu.hidden = true; trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant'); wrapper.classList.remove('is-open');
  }
  function sync() {
    value.textContent = options[select.selectedIndex]?.textContent ?? '';
    trigger.disabled = select.disabled;
    items.forEach((item, index) => item.setAttribute('aria-selected', String(index === select.selectedIndex)));
    if (wrapper.closest('[hidden]')) close();
  }
  function open() {
    for (const control of controls.values()) control.close();
    menu.hidden = false; wrapper.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    wrapper.classList.remove('opens-up'); menu.style.maxHeight = '';
    const bounds = trigger.getBoundingClientRect();
    const below = window.innerHeight - bounds.bottom - 16; const above = bounds.top - 16;
    const height = Math.min(menu.scrollHeight, 280);
    const upward = below < height && above > below;
    wrapper.classList.toggle('opens-up', upward);
    menu.style.maxHeight = `${Math.max(44, Math.min(280, upward ? above : below))}px`;
    highlight(select.selectedIndex);
  }
  function choose(index) {
    if (options[index].disabled) return;
    close(); trigger.focus({preventScroll: true});
    if (select.selectedIndex !== index) {
      select.selectedIndex = index;
      select.dispatchEvent(new window.Event('change', {bubbles: true}));
    }
    sync();
  }
  trigger.addEventListener('click', () => {if (menu.hidden) open(); else close();});
  trigger.addEventListener('blur', close);
  menu.addEventListener('pointerdown', event => event.preventDefault());
  trigger.addEventListener('keydown', event => {
    if (event.key === 'Tab' || event.key === 'Escape') {close(); return;}
    if (['Enter', ' '].includes(event.key)) {
      event.preventDefault(); if (menu.hidden) open(); else choose(active); return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); if (menu.hidden) open();
      const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
      const position = enabled.indexOf(active);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1
        : Math.max(0, Math.min(enabled.length - 1, position + (event.key === 'ArrowDown' ? 1 : -1)));
      highlight(enabled[next]); return;
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault(); if (menu.hidden) open();
      const now = Date.now(); search = now - lastTyped > 700 ? event.key : search + event.key; lastTyped = now;
      const index = options.findIndex(option => !option.disabled && option.textContent.toLowerCase().startsWith(search.toLowerCase()));
      if (index >= 0) highlight(index);
    }
  });
  document.addEventListener('pointerdown', event => {if (!wrapper.contains(event.target)) close();});
  window.addEventListener('resize', close);
  window.addEventListener('scroll', event => {if (!menu.contains(event.target)) close();}, true);
  select.addEventListener('change', sync);
  controls.set(select, {sync, close}); sync();
}

export function enhanceDropdowns() {
  for (const select of document.querySelectorAll('#canvas, #tts-preset, #color-mode')) if (!controls.has(select)) enhance(select);
}
export function syncDropdowns() {
  for (const control of controls.values()) control.sync();
}
