import type {CSSProperties} from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import narration from './narration.json';

const FPS = 30;

const scenes = [
  {id: 'opening', frames: 390, image: 'analysis-home.png'},
  {id: 'workflow', frames: 630, image: 'analysis-form.png'},
  {id: 'gpt', frames: 690, image: null},
  {id: 'public-demo', frames: 570, image: 'northstar-top.png'},
  {id: 'score', frames: 540, image: 'northstar-evidence.png'},
  {id: 'evidence', frames: 630, image: 'northstar-ledger.png'},
  {id: 'gaps', frames: 540, image: 'northstar-gaps.png'},
  {id: 'close', frames: 630, image: 'northstar-methodology.png'},
] as const;

export const BUILD_WEEK_DEMO_FRAMES = scenes.reduce((total, scene) => total + scene.frames, 0);

const palette = {
  ink: '#0a1020',
  paper: '#f7f7f2',
  blue: '#475fe8',
  violet: '#7275f2',
  mint: '#bdf4d6',
  green: '#1d8f5a',
  white: '#ffffff',
};

const textById = new Map(narration.map((segment) => [segment.id, segment]));

const splitSentences = (text: string) =>
  text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((sentence) => sentence.trim());

const Brand = ({light = false}: {light?: boolean}) => (
  <div
    style={{
      color: light ? palette.white : palette.ink,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 26,
      fontWeight: 800,
      letterSpacing: 5,
    }}
  >
    <span>PR</span>
    <span style={{display: 'grid', gap: 4}}>
      <span style={{width: 21, height: 3, background: palette.blue}} />
      <span style={{width: 21, height: 3, background: palette.blue}} />
    </span>
    <span>UVANCE</span>
  </div>
);

const Subtitle = ({text, duration}: {text: string; duration: number}) => {
  const frame = useCurrentFrame();
  const sentences = splitSentences(text);
  const active = Math.min(sentences.length - 1, Math.floor((frame / duration) * sentences.length));
  const opacity = interpolate(frame, [0, 12, duration - 12, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: 220,
        right: 220,
        bottom: 46,
        minHeight: 96,
        display: 'grid',
        placeItems: 'center',
        padding: '18px 34px',
        borderRadius: 18,
        background: 'rgba(6, 10, 22, 0.90)',
        border: '1px solid rgba(255,255,255,.24)',
        boxShadow: '0 18px 46px rgba(0,0,0,.28)',
        color: palette.white,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 34,
        fontWeight: 650,
        lineHeight: 1.22,
        textAlign: 'center',
        opacity,
      }}
    >
      {sentences[active]}
    </div>
  );
};

const FrameChrome = ({title, children}: {title: string; children: React.ReactNode}) => (
  <AbsoluteFill style={{background: palette.paper, color: palette.ink, overflow: 'hidden'}}>
    {children}
    <div
      style={{
        position: 'absolute',
        left: 62,
        right: 62,
        top: 36,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Brand />
      <div
        style={{
          borderRadius: 999,
          padding: '10px 17px',
          background: 'rgba(255,255,255,.92)',
          border: '1px solid rgba(10,16,32,.14)',
          color: palette.blue,
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: 17,
          fontWeight: 800,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
    </div>
  </AbsoluteFill>
);

const ScreenshotScene = ({
  id,
  title,
  image,
  duration,
  disclaimer,
  imageStyle,
}: {
  id: string;
  title: string;
  image: string;
  duration: number;
  disclaimer?: string;
  imageStyle?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const copy = textById.get(id)?.text ?? '';
  const scale = interpolate(frame, [0, duration], [1.035, 1.0]);

  return (
    <FrameChrome title={title}>
      <div
        style={{
          position: 'absolute',
          inset: '96px 54px 142px',
          borderRadius: 28,
          overflow: 'hidden',
          background: palette.white,
          border: '1px solid rgba(10,16,32,.13)',
          boxShadow: '0 28px 78px rgba(20,31,70,.18)',
        }}
      >
        <Img
          src={staticFile(`demo/${image}`)}
          style={{width: '100%', height: '100%', objectFit: 'contain', transform: `scale(${scale})`, ...imageStyle}}
        />
      </div>
      {disclaimer ? (
        <div
          style={{
            position: 'absolute',
            left: 78,
            top: 108,
            padding: '10px 15px',
            borderRadius: 10,
            background: '#fff1cf',
            border: '1px solid #cc8a2f',
            color: '#74430d',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          {disclaimer}
        </div>
      ) : null}
      <Audio src={staticFile(`audio-fast/${id}.wav`)} startFrom={0} />
      <Subtitle text={copy} duration={duration} />
    </FrameChrome>
  );
};

const Opening = ({duration}: {duration: number}) => {
  const frame = useCurrentFrame();
  const copy = textById.get('opening')?.text ?? '';
  const titleOpacity = interpolate(frame, [0, 16, 185, 220], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const screenOpacity = interpolate(frame, [185, 230], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{background: palette.ink, overflow: 'hidden'}}>
      <Img
        src={staticFile('demo/analysis-home.png')}
        style={{width: '100%', height: '100%', objectFit: 'cover', opacity: screenOpacity * 0.78}}
      />
      <AbsoluteFill style={{background: `linear-gradient(90deg, ${palette.ink} 0%, rgba(10,16,32,.86) 45%, rgba(10,16,32,.25))`}} />
      <div style={{position: 'absolute', left: 112, top: 74}}><Brand light /></div>
      <div style={{position: 'absolute', left: 112, top: 245, opacity: titleOpacity}}>
        <div style={{color: palette.mint, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 23, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase'}}>OpenAI Build Week · product demo</div>
        <div style={{color: palette.white, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 104, lineHeight: 0.98, fontWeight: 820, letterSpacing: -4, marginTop: 30}}>Prompt.<br />Scan.<br /><span style={{color: '#9aa7ff'}}>Prove.</span></div>
      </div>
      <Audio src={staticFile('audio-fast/opening.wav')} startFrom={0} />
      <Subtitle text={copy} duration={duration} />
    </AbsoluteFill>
  );
};

const Architecture = ({duration}: {duration: number}) => {
  const frame = useCurrentFrame();
  const copy = textById.get('gpt')?.text ?? '';
  const cards = [
    ['01', 'GPT-5.6', 'Responses API · strict JSON Schema'],
    ['02', 'Rules engine', 'Cross-checks · caps · deadlines'],
    ['03', 'Evidence dossier', 'Ledger · provenance · PDF'],
  ];

  return (
    <FrameChrome title="GPT-5.6 · controlled pipeline">
      <div style={{position: 'absolute', inset: '145px 130px 190px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 38}}>
        {cards.map(([number, heading, detail], index) => {
          const progress = interpolate(frame, [25 + index * 42, 55 + index * 42], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div key={heading} style={{display: 'flex', alignItems: 'center', gap: 38}}>
              <div
                style={{
                  width: 430,
                  minHeight: 300,
                  borderRadius: 28,
                  padding: 38,
                  background: index === 0 ? palette.ink : palette.white,
                  border: index === 2 ? `2px solid ${palette.green}` : '1px solid rgba(10,16,32,.14)',
                  boxShadow: '0 30px 75px rgba(20,31,70,.14)',
                  opacity: progress,
                  transform: `translateY(${(1 - progress) * 34}px)`,
                  fontFamily: 'Arial, Helvetica, sans-serif',
                }}
              >
                <div style={{color: index === 0 ? '#9aa7ff' : palette.blue, fontSize: 19, fontWeight: 900, letterSpacing: 2}}>{number}</div>
                <div style={{color: index === 0 ? palette.white : palette.ink, fontSize: 45, fontWeight: 820, marginTop: 60}}>{heading}</div>
                <div style={{color: index === 0 ? '#c5cbe2' : '#596174', fontSize: 24, lineHeight: 1.35, marginTop: 22}}>{detail}</div>
              </div>
              {index < cards.length - 1 ? <div style={{color: palette.blue, fontSize: 54, fontWeight: 300, opacity: progress}}>→</div> : null}
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 690, top: 755, padding: '13px 22px', borderRadius: 999, background: '#ffe8e5', color: '#9b2d25', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 20, fontWeight: 800}}>No configuration → explicit failure, no fabricated report</div>
      <Audio src={staticFile('audio-fast/gpt.wav')} startFrom={0} />
      <Subtitle text={copy} duration={duration} />
    </FrameChrome>
  );
};

const Closing = ({duration}: {duration: number}) => {
  const frame = useCurrentFrame();
  const copy = textById.get('close')?.text ?? '';
  const screenshotOpacity = interpolate(frame, [0, 80, duration - 120, duration - 35], [0.36, 0.16, 0.16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ctaOpacity = interpolate(frame, [duration - 165, duration - 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{background: palette.ink, overflow: 'hidden'}}>
      <Img src={staticFile('demo/northstar-methodology.png')} style={{width: '100%', height: '100%', objectFit: 'cover', opacity: screenshotOpacity}} />
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(10,16,32,.97), rgba(10,16,32,.76))'}} />
      <div style={{position: 'absolute', left: 112, top: 70}}><Brand light /></div>
      <div style={{position: 'absolute', left: 112, top: 225, maxWidth: 1280, color: palette.white, fontFamily: 'Arial, Helvetica, sans-serif'}}>
        <div style={{fontSize: 84, lineHeight: 1.02, fontWeight: 840, letterSpacing: -3}}>From AI inventory<br />to assurance dossier,<br /><span style={{color: palette.mint}}>evidence by evidence.</span></div>
        <div style={{fontSize: 28, color: '#c5cbe2', marginTop: 38}}>Strict schemas · deterministic checks · human review · real PDF</div>
        <div style={{fontSize: 23, color: '#9aa7ff', marginTop: 28}}>Preuvance does not certify compliance.</div>
      </div>
      <div style={{position: 'absolute', right: 110, top: 720, padding: '22px 34px', borderRadius: 18, background: palette.white, color: palette.ink, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 28, fontWeight: 850, opacity: ctaOpacity}}>Open /demo · no account · no API key</div>
      <Audio src={staticFile('audio-fast/close.wav')} startFrom={0} />
      <Subtitle text={copy} duration={duration} />
    </AbsoluteFill>
  );
};

export const PreuvanceBuildWeekDemo = () => {
  const frame = useCurrentFrame();
  let cursor = 0;

  const renderedScenes = scenes.map((scene) => {
    const from = cursor;
    cursor += scene.frames;

    let content: React.ReactNode;
    if (scene.id === 'opening') {
      content = <Opening duration={scene.frames} />;
    } else if (scene.id === 'gpt') {
      content = <Architecture duration={scene.frames} />;
    } else if (scene.id === 'close') {
      content = <Closing duration={scene.frames} />;
    } else {
      const copy = textById.get(scene.id);
      content = (
        <ScreenshotScene
          id={scene.id}
          title={copy?.title ?? scene.id}
          image={scene.image ?? ''}
          duration={scene.frames}
          disclaimer={scene.id === 'public-demo' || scene.id === 'score' || scene.id === 'evidence' || scene.id === 'gaps' ? 'Fictional Northstar fixture · no model call' : undefined}
        />
      );
    }

    return <Sequence key={scene.id} from={from} durationInFrames={scene.frames}>{content}</Sequence>;
  });

  return (
    <AbsoluteFill>
      {renderedScenes}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, background: 'rgba(71,95,232,.18)'}}>
        <div style={{height: '100%', width: `${(frame / BUILD_WEEK_DEMO_FRAMES) * 100}%`, background: palette.blue}} />
      </div>
    </AbsoluteFill>
  );
};

export const BUILD_WEEK_DEMO_SECONDS = BUILD_WEEK_DEMO_FRAMES / FPS;
