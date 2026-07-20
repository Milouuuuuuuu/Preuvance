import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
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

  // Single point of light, constant speed, no easing on the way in — this is deliberate:
  // no acceleration/deceleration reads as "impact". It just travels.
  const travelStart = 22;
  const travelEnd = 158;
  const settleEnd = travelEnd + 26;

  const travel = interpolate(frame, [travelStart, travelEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Calm status change on arrival — a slow crossfade, not a flash.
  const arrived = interpolate(frame, [travelEnd, settleEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });

  const leftX = width * 0.34;
  const rightX = width * 0.66;
  const railY = height * 0.5;
  const packetX = interpolate(travel, [0, 1], [leftX, rightX]);

  // Very gentle brightness rise as the packet passes through the midpoint ring — no burst, no debris.
  const ringGlow = interpolate(travel, [0.4, 0.5, 0.6], [0.28, 0.62, 0.28], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cylinder = (x: number, accent: string, glow: number) => (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: railY,
        transform: 'translate(-50%, -50%)',
        width: 300,
        height: 320,
        borderRadius: '50% / 15%',
        border: `3px solid ${accent}`,
        background: 'linear-gradient(180deg, rgba(9,22,48,.55), rgba(4,12,28,.85))',
        boxShadow: `0 0 ${70 + glow * 60}px rgba(${accent === colors.green ? '32,199,121' : '83,217,255'},${0.18 + glow * 0.3})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -3,
          left: -3,
          right: -3,
          height: 78,
          borderRadius: '50%',
          border: `3px solid ${accent}`,
          background: colors.navy,
        }}
      />
      {[0.32, 0.6].map((p) => (
        <div key={p} style={{position: 'absolute', left: 0, right: 0, top: `${p * 100}%`, height: 2, background: 'rgba(150,190,240,.22)'}} />
      ))}
    </div>
  );

  return (
    <AbsoluteFill>
      {cylinder(leftX, colors.cyan, 0.4)}
      {/* Right cylinder crossfades cyan → green as the packet settles in: a calm status change, not an explosion. */}
      <div style={{position: 'absolute', inset: 0, opacity: 1 - arrived}}>{cylinder(rightX, colors.cyan, 0.4)}</div>
      <div style={{position: 'absolute', inset: 0, opacity: arrived}}>{cylinder(rightX, colors.green, 0.4 + arrived * 0.5)}</div>

      <div style={{position: 'absolute', left: leftX, top: railY, width: rightX - leftX, height: 2, background: 'rgba(150,190,240,.16)', transform: 'translateY(-1px)'}} />

      {/* Midpoint translucent ring — the packet passes cleanly through it, no collision effect of any kind */}
      <div
        style={{
          position: 'absolute',
          left: width * 0.5,
          top: railY,
          transform: 'translate(-50%, -50%)',
          width: 92,
          height: 132,
          borderRadius: '50%',
          border: `2px solid rgba(83,217,255,${ringGlow})`,
          boxShadow: `0 0 ${30 + ringGlow * 40}px rgba(83,217,255,${ringGlow * 0.6})`,
        }}
      />

      {/* Trailing light streak behind the packet — pure motion blur, no splash or liquid */}
      {travel > 0 && travel < 1 && (
        <div
          style={{
            position: 'absolute',
            left: leftX,
            top: railY,
            width: Math.max(0, packetX - leftX),
            height: 6,
            transform: 'translateY(-3px)',
            background: 'linear-gradient(90deg, rgba(23,92,255,0), rgba(83,217,255,.55))',
            filter: 'blur(1px)',
          }}
        />
      )}

      {/* The single point of light itself — no lightning bolt icon */}
      {travel < 1 && (
        <div
          style={{
            position: 'absolute',
            left: packetX,
            top: railY,
            transform: 'translate(-50%, -50%)',
            width: 34,
            height: 34,
            borderRadius: 999,
            background: colors.cyan,
            boxShadow: `0 0 40px ${colors.cyan}, 0 0 80px rgba(83,217,255,.5)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
