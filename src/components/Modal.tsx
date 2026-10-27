import { useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function Modal({
  title,
  onClose,
  children,
  eyebrow = "ВАШЕ ПУТЕШЕСТВИЕ",
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={["tv-dialog", className].filter(Boolean).join(" ")}
      aria-labelledby="dialog-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <header className="tv-dialog-heading">
        <div>
          <p className="tv-eyebrow">{eyebrow}</p>
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button
          className="tv-icon-button"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <X />
        </button>
      </header>
      <div className="tv-dialog-content">{children}</div>
    </dialog>
  );
}
