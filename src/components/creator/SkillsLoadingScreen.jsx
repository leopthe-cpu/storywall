import StoryLoadingScreen, { SHARED_LINES, SKILLS_LINES, stepCeiling } from '@/components/creator/StoryLoadingScreen';

// Loading screen shown between the Story Builder and the Publish screen
// while skills are being generated. There's no real step signal for this
// single call, so it's one step: the percentage eases toward 90% and holds
// there until the result arrives and this screen unmounts (phase flips to
// 'ready' in PostFlowSheet).
const LINES = [...SKILLS_LINES, ...SHARED_LINES.slice(0, 4)];

export default function SkillsLoadingScreen({ onClose }) {
  return <StoryLoadingScreen ceiling={stepCeiling(0, 1, 0, 100)} tau={1400} lines={LINES} onBack={onClose} />;
}
