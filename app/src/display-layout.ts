export function valueRows(text: string) {
    return text.split('\n').flatMap((line, index) => {
        const match = line.match(/^([A-Z][A-Z ]+?) {2,}(\S.*)$/);
        return match ? [{ line: index, label: match[1], value: match[2] }] : [];
    });
}
export function valueColumn(text: string) {
    const rows = valueRows(text);
    if (!rows.length) return null;
    const first = rows[0].line, last = rows.at(-1)!.line;
    if (last - first > 4) return null;
    const height = (last - first + 1) * 27;
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = height;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#000'; context.fillRect(0, 0, 240, height);
    context.fillStyle = '#fff'; context.font = '21px sans-serif'; context.textAlign = 'right'; context.textBaseline = 'top';
    for (const row of rows) context.fillText(row.value, 228, (row.line - first) * 27 + 1, 228);
    const pixels = context.getImageData(0, 0, 240, height).data;
    const imageData = Array.from({ length: 240 * height }, (_, i) => pixels[i * 4]);
    const labels = text.split('\n'); for (const row of rows) labels[row.line] = row.label;
    return { content: labels.join('\n'), imageData, y: 8 + first * 27, height, key: `${first}:${last}` };
}
