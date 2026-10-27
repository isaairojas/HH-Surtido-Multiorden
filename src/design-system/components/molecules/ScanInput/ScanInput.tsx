/**
 * Figma: Scanner Input Container (Teclado + Input)
 * nodeId: 3048:10192
 * URL: https://www.figma.com/design/zZBoCtJor0tdJ91umiqb7l/?node-id=3048-10192
 * Última sincronización: 2026-09-29
 */
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import teclado from '@assets/icons/teclado.svg';
import styles from './ScanInput.module.css';

type Props = {
  /** Se llama tras 300 ms sin teclear o al presionar Enter (lector HID). Ver docs/tecnico/referencias.md §1. */
  onScan: (code: string) => void;
  autoFocus?: boolean;
};

export type ScanInputHandle = { focus: () => void };

/**
 * Campo del lector. Por defecto no abre el teclado del sistema (inputMode="none"): el lector Zebra
 * escribe como teclado. El botón ⌨ alterna a captura manual.
 */
export const ScanInput = forwardRef<ScanInputHandle, Props>(function ScanInput({ onScan, autoFocus = true }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [manual, setManual] = useState(false);
  const timer = useRef<number>();

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  const submit = (v: string) => {
    window.clearTimeout(timer.current);
    const code = v.trim();
    if (!code) return;
    setValue('');
    setManual(false);
    onScan(code);
  };

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.keyboard}
        aria-label="Teclado"
        aria-pressed={manual}
        onClick={() => {
          setManual((m) => !m);
          inputRef.current?.focus();
        }}
      >
        <img src={teclado} alt="" width={50} height={50} />
      </button>
      <div className={styles.field}>
        <input
          ref={inputRef}
          className={`${styles.input} ${value ? '' : styles.empty}`}
          value={value}
          inputMode={manual ? 'numeric' : 'none'}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-label="Código"
          onChange={(e) => {
            const v = e.target.value;
            setValue(v);
            window.clearTimeout(timer.current);
            // Lector: 300 ms (Revision-HH). Captura manual: 800 ms, igual que el AFTER_TIMEOUT de 3236:15851 en Figma.
            timer.current = window.setTimeout(() => submit(v), manual ? 800 : 300);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(value);
          }}
        />
        {!value && <span className={styles.caret} aria-hidden />}
      </div>
    </div>
  );
});
