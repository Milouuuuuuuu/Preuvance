import {
  AbsoluteFill,
  Img,
  Sequence,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Background, Brand, Pill, Reveal, Scene, safeArea} from './shared';
import {BridgeProcedural, EvidenceProcedural, OpeningProcedural} from './ProceduralBackgrounds';
import {colors, glass} from './theme';

export type PreuvanceFilmProps = {
  useHiggsfield: boolean;
};

const HiggsfieldLayer = ({
  enabled,
  file,
  fallback,
}: {
  enabled: boolean;
  file: string;
  fallback: React.ReactNode;
}) => (
  <AbsoluteFill>
    {enabled ? (
      <Video
        src={staticFile(`higgsfield/output/${file}`)}
        muted
        loop
        style={{width: '100%', height: '100%', objectFit: 'cover', opacity: 0.82}}
      />
    ) : (
      fallback
    )}
    <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(2,11,31,.9), rgba(2,11,31,.3) 58%, rgba(2,11,31,.72))'}} />
  </AbsoluteFill>
);

const Hook = ({useHiggsfield}: PreuvanceFilmProps) => {
  const {width, height} = useVideoConfig();
  const vertical = height > width;
  return (
    <Scene duration={150}>
      <HiggsfieldLayer enabled={useHiggsfield} file="opening.mp4" fallback={<OpeningProcedural />} />
      <AbsoluteFill style={{...safeArea(vertical), justifyContent: 'space-between'}}>
        <Brand small />
        <div style={{maxWidth: vertical ? width * 0.85 : width * 0.56, marginBottom: vertical ? 180 : 60}}>
          <Reveal>
            <Pill accent={colors.green}>Hackathon 2026</Pill>
          </Reveal>
          <Reveal delay={10}>
            <div style={{fontSize: vertical ? 93 : 104, lineHeight: 0.98, fontWeight: 760, letterSpacing: -4, marginTop: 30}}>
              Une IA peut convaincre.
            </div>
          </Reveal>
          <Reveal delay={24}>
            <div style={{fontSize: vertical ? 70 : 78, lineHeight: 1.05, color: colors.cyan, fontWeight: 720, marginTop: 18}}>
              Peut-elle prouver&nbsp;?
            </div>
          </Reveal>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const Problem = () => {
  const {width, height} = useVideoConfig();
  const vertical = height > width;
  const items = [
    ['Promesses', 'Ce que le système affirme'],
    ['Faits', 'Ce qui est réellement observé'],
    ['Sources', 'Ce qui peut être vérifié'],
  ];
  return (
    <Scene duration={180}>
      <AbsoluteFill style={{...safeArea(vertical), justifyContent: 'center'}}>
        <Reveal><div style={{fontSize: vertical ? 66 : 78, fontWeight: 760, maxWidth: 1250}}>Le risque commence dans l’écart.</div></Reveal>
        <div style={{display: 'grid', gridTemplateColumns: vertical ? '1fr' : 'repeat(3, 1fr)', gap: 24, marginTop: 70}}>
          {items.map(([title, copy], index) => (
            <Reveal key={title} delay={18 + index * 11}>
              <div style={{...glass, borderRadius: 28, padding: vertical ? 38 : 34, minHeight: vertical ? 190 : 220}}>
                <div style={{fontSize: vertical ? 39 : 36, color: index === 2 ? colors.green : index === 1 ? colors.cyan : colors.blue, fontWeight: 780}}>{title}</div>
                <div style={{fontSize: vertical ? 30 : 27, color: colors.muted, lineHeight: 1.35, marginTop: 20}}>{copy}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const Dossier = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const vertical = height > width;
  const imageScale = interpolate(frame, [0, 240], [1.08, 1]);
  return (
    <Scene duration={240}>
      <AbsoluteFill style={{...safeArea(vertical), display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', gap: vertical ? 70 : 90}}>
        <div style={{flex: 0.82, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <Reveal><Pill>Le dossier de preuve</Pill></Reveal>
          <Reveal delay={12}><div style={{fontSize: vertical ? 70 : 84, lineHeight: 1.02, fontWeight: 770, marginTop: 34}}>Du risque IA<br /><span style={{color: colors.green}}>à la preuve.</span></div></Reveal>
          <Reveal delay={26}><div style={{fontSize: vertical ? 31 : 30, color: colors.muted, lineHeight: 1.42, marginTop: 32}}>Un parcours local pour confronter le déclaré, l’observé et la contre-vérification.</div></Reveal>
        </div>
        <Reveal delay={12} style={{flex: 1.3, width: '100%'}}>
          <div style={{...glass, borderRadius: 34, overflow: 'hidden', transform: `scale(${imageScale})`, boxShadow: '0 40px 110px rgba(0,0,0,.5)'}}>
            <Img src={staticFile('brand/og-v2.png')} style={{width: '100%', display: 'block'}} />
          </div>
        </Reveal>
      </AbsoluteFill>
    </Scene>
  );
};

const Evidence = ({useHiggsfield}: PreuvanceFilmProps) => {
  const {width, height} = useVideoConfig();
  const vertical = height > width;
  return (
    <Scene duration={210}>
      <HiggsfieldLayer enabled={useHiggsfield} file="evidence.mp4" fallback={<EvidenceProcedural />} />
      <AbsoluteFill style={{...safeArea(vertical), justifyContent: 'space-between'}}>
        <Reveal><Brand small /></Reveal>
        <div style={{maxWidth: vertical ? '100%' : '62%', marginBottom: vertical ? 190 : 50}}>
          <Reveal delay={12}><div style={{fontSize: vertical ? 76 : 86, lineHeight: 1.02, fontWeight: 770}}>Chaque conclusion garde<br /><span style={{color: colors.cyan}}>sa chaîne de preuve.</span></div></Reveal>
          <Reveal delay={30}><div style={{display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 34}}><Pill>Traçabilité</Pill><Pill accent={colors.cyan}>Sources</Pill><Pill accent={colors.green}>Contre-vérification</Pill></div></Reveal>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const Bridge = ({useHiggsfield}: PreuvanceFilmProps) => {
  const {width, height} = useVideoConfig();
  const vertical = height > width;
  return (
    <Scene duration={210}>
      <HiggsfieldLayer enabled={useHiggsfield} file="bridge.mp4" fallback={<BridgeProcedural />} />
      <AbsoluteFill style={{...safeArea(vertical), justifyContent: 'space-between'}}>
        <Reveal><Pill accent={colors.green}>Local d’abord</Pill></Reveal>
        <div style={{maxWidth: vertical ? '100%' : '65%', marginBottom: vertical ? 170 : 40}}>
          <Reveal delay={16}><div style={{fontSize: vertical ? 75 : 88, lineHeight: 1.02, fontWeight: 770}}>Les preuves restent<br /><span style={{color: colors.green}}>portables.</span></div></Reveal>
          <Reveal delay={32}><div style={{fontSize: vertical ? 31 : 31, color: colors.muted, marginTop: 28, lineHeight: 1.4}}>SQLite ↔ PostgreSQL · migration inspectable · aucun envoi silencieux.</div></Reveal>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const Score = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const vertical = height > width;
  const score = Math.round(interpolate(frame, [18, 115], [0, 86], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  return (
    <Scene duration={210}>
      <AbsoluteFill style={{...safeArea(vertical), alignItems: 'center', justifyContent: 'center'}}>
        <Reveal><Pill accent={colors.green}>Prêt pour la démonstration</Pill></Reveal>
        <div style={{display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', gap: vertical ? 50 : 105, marginTop: 45}}>
          <Reveal delay={12}>
            <div style={{width: vertical ? 370 : 400, height: vertical ? 370 : 400, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'conic-gradient(#20c779 0 86%, rgba(130,160,210,.16) 86%)', boxShadow: '0 0 90px rgba(32,199,121,.22)'}}>
              <div style={{width: '82%', height: '82%', borderRadius: 999, background: colors.ink, display: 'grid', placeItems: 'center', textAlign: 'center'}}>
                <div><span style={{fontSize: vertical ? 112 : 124, fontWeight: 820}}>{score}</span><span style={{fontSize: 34, color: colors.muted}}>/100</span><div style={{fontSize: 22, color: colors.green, letterSpacing: 3}}>HACKATHON</div></div>
              </div>
            </div>
          </Reveal>
          <div style={{maxWidth: 760}}>
            <Reveal delay={22}><div style={{fontSize: vertical ? 67 : 77, fontWeight: 770, lineHeight: 1.04}}>Un MVP qui raconte<br />déjà <span style={{color: colors.cyan}}>une offre.</span></div></Reveal>
            <Reveal delay={38}><div style={{fontSize: vertical ? 30 : 30, color: colors.muted, lineHeight: 1.5, marginTop: 30}}>Dossier local · abonnement par dossier · distribution B2B2B.</div></Reveal>
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const Cta = () => {
  const {width, height} = useVideoConfig();
  const vertical = height > width;
  return (
    <Scene duration={240}>
      <AbsoluteFill style={{...safeArea(vertical), justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
        <Reveal><Brand /></Reveal>
        <Reveal delay={18}><div style={{fontSize: vertical ? 76 : 92, fontWeight: 780, lineHeight: 1.04, marginTop: 70, maxWidth: 1320}}>Rendre les systèmes IA<br /><span style={{color: colors.green}}>vérifiables.</span></div></Reveal>
        <Reveal delay={38}><div style={{fontSize: vertical ? 31 : 32, color: colors.muted, marginTop: 34}}>Du risque à la preuve. De la preuve à la confiance.</div></Reveal>
        <Reveal delay={54}><div style={{...glass, marginTop: 60, borderRadius: 999, padding: '20px 32px', fontSize: vertical ? 27 : 28, fontWeight: 720, color: colors.cyan}}>Démonstration hackathon 2026 · Mode local</div></Reveal>
      </AbsoluteFill>
    </Scene>
  );
};

export const PreuvanceFilm = (props: PreuvanceFilmProps) => (
  <Background>
    <Sequence from={0} durationInFrames={150}><Hook {...props} /></Sequence>
    <Sequence from={150} durationInFrames={180}><Problem /></Sequence>
    <Sequence from={330} durationInFrames={240}><Dossier /></Sequence>
    <Sequence from={570} durationInFrames={210}><Evidence {...props} /></Sequence>
    <Sequence from={780} durationInFrames={210}><Bridge {...props} /></Sequence>
    <Sequence from={990} durationInFrames={210}><Score /></Sequence>
    <Sequence from={1200} durationInFrames={240}><Cta /></Sequence>
  </Background>
);
