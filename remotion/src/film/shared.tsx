import type {CSSProperties, ReactNode} from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {colors, fontFamily, glass} from './theme';

export const Background = ({children}: {children?: ReactNode}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const drift = interpolate(frame, [0, 1440], [0, 180]);

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 75% 20%, rgba(23,92,255,.22), transparent 34%), radial-gradient(circle at 18% 84%, rgba(32,199,121,.12), transparent 30%), #020b1f',
        color: colors.white,
        fontFamily,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -220,
          opacity: 0.28,
          transform: `translate3d(${drift}px, ${-drift * 0.35}px, 0)`,
          backgroundImage:
            'linear-gradient(rgba(86,127,191,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(86,127,191,.16) 1px, transparent 1px)',
          backgroundSize: `${Math.max(58, width / 24)}px ${Math.max(58, height / 14)}px`,
          maskImage: 'radial-gradient(circle at center, black, transparent 72%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: width * 0.45,
          height: width * 0.45,
          borderRadius: '50%',
          right: -width * 0.12,
          top: -width * 0.2,
          filter: 'blur(80px)',
          background: 'rgba(23, 92, 255, .18)',
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

export const Brand = ({small = false}: {small?: boolean}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: small ? 12 : 18,
      fontSize: small ? 27 : 44,
      letterSpacing: small ? 7 : 12,
      fontWeight: 700,
    }}
  >
    <span>PR</span>
    <span style={{display: 'grid', gap: small ? 5 : 7}}>
      <span style={{width: small ? 24 : 38, height: small ? 4 : 6, background: colors.blue}} />
      <span style={{width: small ? 24 : 38, height: small ? 4 : 6, background: colors.blue}} />
    </span>
    <span>UVANCE</span>
  </div>
);

export const Scene = ({
  children,
  duration,
  style,
}: {
  children: ReactNode;
  duration: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 16, duration - 16, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });
  const scale = interpolate(frame, [0, duration], [1.025, 1]);

  return (
    <AbsoluteFill style={{opacity, transform: `scale(${scale})`, ...style}}>
      {children}
    </AbsoluteFill>
  );
};

export const Reveal = ({
  children,
  delay = 0,
  y = 40,
  style,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = spring({frame: frame - delay, fps, config: {damping: 18, stiffness: 120}});

  return (
    <div style={{opacity: progress, transform: `translateY(${(1 - progress) * y}px)`, ...style}}>
      {children}
    </div>
  );
};

export const Pill = ({children, accent = colors.blue}: {children: ReactNode; accent?: string}) => (
  <div
    style={{
      ...glass,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 18px',
      borderRadius: 999,
      color: colors.white,
      fontSize: 22,
      fontWeight: 650,
      letterSpacing: 0.5,
    }}
  >
    <span style={{width: 9, height: 9, borderRadius: 99, background: accent, boxShadow: `0 0 18px ${accent}`}} />
    {children}
  </div>
);

export const safeArea = (vertical: boolean): CSSProperties => ({
  padding: vertical ? '140px 76px' : '72px 110px',
});
