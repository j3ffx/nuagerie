import common from '../../ui/common.module.css';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';

export function MapScreen() {
  return (
    <>
      <ScreenHeader title="Carte" />
      <div className={common.page}>
        <p className={common.muted}>La carte arrive bientôt.</p>
      </div>
    </>
  );
}
