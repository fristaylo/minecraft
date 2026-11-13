import { getCurrentWindow } from '@tauri-apps/api/window';
import { Icon } from '@components/Icon/Icon';
import s from './Titlebar.module.scss';

export function WindowButtons() {
  return (
    <div className={s.winbtns}>
      <button className={s.winbtn} type="button" aria-label="Свернуть" onClick={() => void getCurrentWindow().minimize()}>
        <Icon name="minus" size={16} />
      </button>
      <button className={s.winbtn} type="button" aria-label="Развернуть" onClick={() => void getCurrentWindow().toggleMaximize()}>
        <Icon name="square" size={14} />
      </button>
      <button className={`${s.winbtn} ${s.close}`} type="button" aria-label="Закрыть" onClick={() => void getCurrentWindow().close()}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
