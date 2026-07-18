import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {colors, glass} from './theme';

export const OpeningProcedural = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const rotate = interpolate(frame, [0, 150], [-6, 2]);
  const lift = interpolate(frame, [0, 150], [32, -18]);

  return (
    <AbsoluteFill style={{opacity: 0.9}}>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          style={{
            ...glass,
            position: 'absolute',
            width: width * 0.42,
            height: height * 0.58,
            right: width * (0.08 + index * 0.025),
            top: height * (0.17 - index * 0.02),
            borderRadius: 34,
            transform: `translateY(${lift - index * 18}px) rotate(${rotate - index * 2}deg)`,
            opacity: 1 - index * 0.18,
          }}
        >
          <div style={{margin: 42, display: 'grid', gap: 24}}>
            <div style={{width: '42%', height: 14, borderRadius: 8, background: colors.blue}} />
            {[0.92, 0.72, 0.84, 0.55].map((ratio, line) => (
              <div key={line} style={{width: `${ratio * 100}%`, height: 8, borderRadius: 8, background: colors.line}} />
            ))}
          </div>
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          right: width * 0.14,
          bottom: height * 0.12,
          width: 130,
          height: 130,
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          background: colors.green,
          color: '#02170d',
          fontSize: 74,
          fontWeight: 900,
          boxShadow: '0 0 80px rgba(32,199,121,.45)',
        }}
      >
        ✓
      </div>
    </AbsoluteFill>
  );
};

export const EvidenceProcedural = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const progress = interpolate(frame, [0, 210], [0, 1], {extrapolateRight: 'clamp'});
  const points = [
    {label: 'DÉCLARÉ', color: colors.blue},
    {label: 'OBSERVÉ', color: colors.cyan},
    {label: 'CONTRE-VÉRIFIÉ', color: colors.green},
  ];

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: width * 0.16,
          top: height * 0.52,
          width: width * 0.68,
          height: 4,
          background: colors.line,
        }}
      >
        <div style={{width: `${progress * 100}%`, height: '100%', background: `linear-gradient(90deg, ${colors.blue}, ${colors.green})`, boxShadow: `0 0 24px ${colors.blue}`}} />
      </div>
      {points.map((point, index) => {
        const active = interpolate(progress, [index / 3, (index + 0.6) / 3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return (
          <div
            key={point.label}
            style={{
              position: 'absolute',
              left: width * (0.16 + index * 0.34),
              top: height * 0.52,
              transform: 'translate(-50%, -50%)',
              display: 'grid',
              justifyItems: 'center',
              gap: 30,
            }}
          >
            <div style={{width: 92, height: 92, borderRadius: 99, border: `4px solid ${point.color}`, background: colors.ink, boxShadow: `0 0 ${50 * active}px ${point.color}`, transform: `scale(${0.86 + active * 0.14})`}} />
            <div style={{fontSize: 25, letterSpacing: 3, fontWeight: 750, color: point.color}}>{point.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const BridgeProcedural = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const pulse = 0.5 + Math.sin(frame / 7) * 0.5;

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: width * 0.22}}>
        {['SQLite', 'PostgreSQL'].map((label, index) => (
          <div key={label} style={{...glass, width: 280, height: 240, borderRadius: '50% / 18%', display: 'grid', placeItems: 'center', fontSize: 35, fontWeight: 750, color: index === 0 ? colors.cyan : colors.white, boxShadow: `0 0 70px rgba(23,92,255,${0.18 + pulse * 0.18})`}}>
            {label}
          </div>
        ))}
      </div>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        <path d={`M ${width * 0.36} ${height * 0.5} C ${width * 0.43} ${height * 0.34}, ${width * 0.57} ${height * 0.34}, ${width * 0.64} ${height * 0.5}`} fill="none" stroke="rgba(83,217,255,.35)" strokeWidth="7" strokeDasharray="18 16" strokeDashoffset={-frame * 3} />
      </svg>
      <div style={{position: 'absolute', left: '50%', top: '42%', transform: 'translate(-50%, -50%)', width: 116, height: 116, borderRadius: 999, display: 'grid', placeItems: 'center', background: colors.blue, boxShadow: `0 0 ${55 + pulse * 30}px rgba(23,92,255,.7)`, fontSize: 50}}>⌁</div>
    </AbsoluteFill>
  );
};
