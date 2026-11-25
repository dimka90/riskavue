const marketNames: Record<string, string> = { BTCUSDT: 'Bitcoin', ETHUSDT: 'Ethereum', SOLUSDT: 'Solana' };

export function enhanceTradeSelects(form: HTMLFormElement) {
    let closeCurrent: (() => void) | undefined;
    for (const select of form.querySelectorAll('select')) {
        const label = select.parentElement!;
        const name = label.firstChild?.textContent?.trim() || select.name;
        const wrapper = document.createElement('div'); wrapper.className = 'trade-select';
        const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'trade-select-trigger';
        trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-label', name);
        trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false');
        const list = document.createElement('div'); list.className = 'trade-select-menu'; list.id = `trade-${select.name}-options`;
        list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', name); list.hidden = true;
        trigger.setAttribute('aria-controls', list.id);
        const options = [...select.options];
        const title = (option: HTMLOptionElement) => marketNames[option.value] ? option.value.replace('USDT', ' / USDT') : option.text;
        let active = select.selectedIndex;
        const buttons = options.map((option, index) => {
            const button = document.createElement('button'); button.type = 'button'; button.tabIndex = -1;
            button.className = 'trade-select-option'; button.id = `${list.id}-${index}`; button.setAttribute('role', 'option');
            const text = document.createElement('span'); text.className = 'trade-select-option-text'; text.textContent = title(option);
            if (marketNames[option.value]) { const detail = document.createElement('small'); detail.textContent = marketNames[option.value]; text.append(detail); }
            const check = document.createElement('span'); check.className = 'trade-select-check'; check.textContent = '✓'; check.setAttribute('aria-hidden', 'true');
            button.append(text, check);
            button.onpointerdown = e => e.preventDefault();
            button.onclick = e => { e.preventDefault(); choose(index); };
            list.append(button); return button;
        });
        function paint() {
            trigger.textContent = title(options[select.selectedIndex]);
            buttons.forEach((button, index) => { button.setAttribute('aria-selected', String(index === select.selectedIndex)); button.classList.toggle('active', index === active); });
            if (!list.hidden) trigger.setAttribute('aria-activedescendant', buttons[active].id);
        }
        function close() { list.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-activedescendant'); }
        function open() { closeCurrent?.(); closeCurrent = close; active = select.selectedIndex; list.hidden = false; trigger.setAttribute('aria-expanded', 'true'); paint(); }
        function choose(index: number) { select.selectedIndex = index; active = index; select.dispatchEvent(new Event('change', { bubbles: true })); close(); trigger.focus(); }
        trigger.onclick = e => { e.preventDefault(); if (list.hidden) open(); else close(); };
        trigger.onkeydown = e => {
            if (e.key === 'Tab') { close(); return; }
            if (e.key === 'Escape') { e.preventDefault(); close(); return; }
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                e.preventDefault(); if (list.hidden) open();
                else active = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (active + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
                paint(); return;
            }
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (list.hidden) open(); else choose(active); return; }
            if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
                const match = options.findIndex(option => title(option).toLowerCase().startsWith(e.key.toLowerCase()));
                if (match !== -1) { e.preventDefault(); if (list.hidden) open(); active = match; paint(); }
            }
        };
        wrapper.addEventListener('focusout', e => { if (!wrapper.contains(e.relatedTarget as Node | null)) close(); });
        document.addEventListener('pointerdown', e => { if (!wrapper.contains(e.target as Node)) close(); });
        select.addEventListener('change', () => { active = select.selectedIndex; paint(); });
        form.addEventListener('reset', () => setTimeout(() => { active = select.selectedIndex; paint(); close(); }, 0));
        select.hidden = true;
        wrapper.append(trigger, list); label.append(wrapper); paint();
    }
}
