import common from '../../ui/common.module.css';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';

export function AllScreen() {
  return (
    <>
      <ScreenHeader title="Tout" />
      <div className={common.page}>
        <p className={common.muted}>Toutes les photos arrivent bientôt.</p>
      </div>
    </>
  );
}
