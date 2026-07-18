import {Composition, Still} from 'remotion';
import {PreuvanceFilm, type PreuvanceFilmProps} from './film/PreuvanceFilm';
import {
  BridgeFrame,
  EvidenceFrame,
  OpeningFrame,
} from './higgsfield/HiggsfieldFrames';

const defaultProps: PreuvanceFilmProps = {
  useHiggsfield: false,
};

export const RemotionRoot = () => (
  <>
    <Composition
      id="PreuvanceHackathon"
      component={PreuvanceFilm}
      durationInFrames={1440}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={defaultProps}
    />
    <Composition
      id="PreuvanceHackathonVertical"
      component={PreuvanceFilm}
      durationInFrames={1440}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
    />
    <Still id="HiggsfieldOpening" component={OpeningFrame} width={1920} height={1080} />
    <Still id="HiggsfieldEvidence" component={EvidenceFrame} width={1920} height={1080} />
    <Still id="HiggsfieldBridge" component={BridgeFrame} width={1920} height={1080} />
  </>
);
