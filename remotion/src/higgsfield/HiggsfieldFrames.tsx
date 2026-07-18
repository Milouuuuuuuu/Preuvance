import {AbsoluteFill, useVideoConfig} from 'remotion';
import {colors, glass} from '../film/theme';

const StillBackground = ({children}: {children: React.ReactNode}) => (
  <AbsoluteFill style={{overflow: 'hidden', background: 'radial-gradient(circle at 70% 24%, rgba(23,92,255,.3), transparent 34%), radial-gradient(circle at 20% 84%, rgba(32,199,121,.16), transparent 31%), #020b1f'}}>
    <div style={{position: 'absolute', inset: -100, opacity: 0.24, backgroundImage: 'linear-gradient(rgba(120,160,220,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(120,160,220,.16) 1px, transparent 1px)', backgroundSize: '72px 72px', maskImage: 'radial-gradient(circle at center, black, transparent 76%)'}} />
    {children}
  </AbsoluteFill>
);

export const OpeningFrame = () => {
  const {width, height} = useVideoConfig();
  return (
    <StillBackground>
      {[0, 1, 2].map((index) => (
        <div key={index} style={{...glass, position: 'absolute', width: width * 0.42, height: height * 0.6, left: width * (0.31 + index * 0.035), top: height * (0.18 - index * 0.025), borderRadius: 38, transform: `rotate(${-9 + index * 5}deg)`, boxShadow: '0 34px 90px rgba(0,0,0,.55)'}}>
          <div style={{margin: 52, display: 'grid', gap: 30}}>
            <div style={{width: '44%', height: 18, borderRadius: 9, background: colors.blue}} />
            {[0.88, 0.72, 0.82, 0.57].map((ratio, line) => <div key={line} style={{width: `${ratio * 100}%`, height: 11, borderRadius: 9, background: 'rgba(140,180,240,.23)'}} />)}
          </div>
        </div>
      ))}
      <div style={{position: 'absolute', right: width * 0.21, bottom: height * 0.13, width: 150, height: 150, borderRadius: 999, display: 'grid', placeItems: 'center', background: colors.green, color: '#02170d', fontSize: 82, fontWeight: 900, boxShadow: '0 0 100px rgba(32,199,121,.5)'}}>✓</div>
    </StillBackground>
  );
};

export const EvidenceFrame = () => {
  const {width, height} = useVideoConfig();
  const pointColors = [colors.blue, colors.cyan, colors.green];
  return (
    <StillBackground>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        <path d={`M ${width * 0.17} ${height * 0.54} C ${width * 0.35} ${height * 0.23}, ${width * 0.64} ${height * 0.82}, ${width * 0.83} ${height * 0.42}`} fill="none" stroke="rgba(83,217,255,.5)" strokeWidth="9" strokeDasharray="22 18" />
      </svg>
      {pointColors.map((color, index) => (
        <div key={color} style={{position: 'absolute', left: `${18 + index * 32}%`, top: `${54 - index * 6}%`, transform: 'translate(-50%, -50%)', width: 160 + index * 24, height: 160 + index * 24, borderRadius: 999, border: `7px solid ${color}`, background: 'rgba(2,11,31,.86)', boxShadow: `0 0 90px ${color}`}}>
          <div style={{position: 'absolute', inset: 28, borderRadius: 999, background: color, opacity: 0.24}} />
        </div>
      ))}
    </StillBackground>
  );
};

export const BridgeFrame = () => {
  const {width, height} = useVideoConfig();
  return (
    <StillBackground>
      {[0, 1].map((index) => (
        <div key={index} style={{...glass, position: 'absolute', left: `${index ? 69 : 31}%`, top: '53%', transform: 'translate(-50%, -50%)', width: 330, height: 360, borderRadius: '50% / 14%', border: `4px solid ${index ? colors.green : colors.cyan}`, boxShadow: `0 0 100px ${index ? 'rgba(32,199,121,.34)' : 'rgba(83,217,255,.34)'}`}}>
          <div style={{position: 'absolute', top: -4, left: -4, right: -4, height: 90, borderRadius: '50%', border: `4px solid ${index ? colors.green : colors.cyan}`, background: colors.navy}} />
          {[0.35, 0.62].map((position) => <div key={position} style={{position: 'absolute', left: 0, right: 0, top: `${position * 100}%`, height: 2, background: 'rgba(150,190,240,.26)'}} />)}
        </div>
      ))}
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        <path d={`M ${width * 0.4} ${height * 0.48} C ${width * 0.46} ${height * 0.25}, ${width * 0.54} ${height * 0.25}, ${width * 0.6} ${height * 0.48}`} fill="none" stroke="rgba(83,217,255,.72)" strokeWidth="10" strokeDasharray="21 17" />
      </svg>
      <div style={{position: 'absolute', left: '50%', top: '35%', transform: 'translate(-50%, -50%)', width: 142, height: 142, borderRadius: 999, display: 'grid', placeItems: 'center', background: colors.blue, color: colors.white, fontSize: 62, boxShadow: '0 0 90px rgba(23,92,255,.75)'}}>⌁</div>
    </StillBackground>
  );
};
