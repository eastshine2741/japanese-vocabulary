export const verticalText = (line: string) => [...line.replace(/ー/g, '丨')].join('\n');
