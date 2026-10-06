import common from '../../ui/common.module.css';
import { Logo } from '../../ui/Logo.tsx';
import { ScreenHeader } from '../../ui/ScreenHeader.tsx';

export function AlbumsScreen() {
  return (
    <>
      <ScreenHeader title="Albums" leading={<Logo size={32} />} />
      <div className={common.page}>
        <p className={common.muted}>Les albums arrivent bientôt.</p>
      </div>
    </>
  );
}
