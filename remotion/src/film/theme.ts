import type {CSSProperties} from 'react';

export const colors = {
  ink: '#020b1f',
  navy: '#071a3d',
  blue: '#175cff',
  cyan: '#53d9ff',
  green: '#20c779',
  white: '#f7f9ff',
  muted: '#9bb0d0',
  line: 'rgba(132, 168, 225, 0.25)',
};

export const fontFamily =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const glass: CSSProperties = {
  background: 'linear-gradient(145deg, rgba(17, 42, 89, 0.82), rgba(4, 15, 38, 0.7))',
  border: `1px solid ${colors.line}`,
  boxShadow: '0 28px 80px rgba(0, 7, 24, 0.42)',
  backdropFilter: 'blur(22px)',
};
