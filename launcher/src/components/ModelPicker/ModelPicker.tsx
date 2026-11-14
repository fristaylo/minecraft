import type { SkinModel } from '@/api';
import s from './ModelPicker.module.scss';

const MODELS: [SkinModel, string, string][] = [
  ['classic', 'Классическая', 'Руки шириной 4 пикселя'],
  ['slim', 'Тонкая', 'Руки шириной 3 пикселя'],
];

export function ModelPicker({ value, onChange }: { value: SkinModel; onChange: (model: SkinModel) => void }) {
  return (
    <div className={s.models}>
      {MODELS.map(([model, title, hint]) => (
        <button key={model} className={s.opt} type="button" aria-pressed={value === model} onClick={() => onChange(model)}>
          <b>{title}</b>
          <span>{hint}</span>
        </button>
      ))}
    </div>
  );
}
