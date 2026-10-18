import { Bold, Italic, RotateCcw, Type, Plus, Trash2 } from "lucide-react";
import { useSessionStore } from "../../state/useSessionStore";
import {
  TITLE_FONTS,
  TEXT_STYLE_PRESETS,
  DEFAULT_TITLE_STYLE,
  titleFont,
} from "../../data/textStyles";

export default function TextStyleControls({
  readOnly,
  selectedTextId,
  onSelectText,
}: {
  readOnly: boolean;
  selectedTextId: string | null;
  onSelectText: (id: string | null) => void;
}) {
  const session = useSessionStore();
  const active = session.textLayers.find(
    (layer) => layer.id === selectedTextId,
  );
  const stripTitle = active ? active.text : session.stripTitle;
  const setStripTitle = (text: string) =>
    active
      ? session.updateTextLayer(active.id, { text })
      : session.setStripTitle(text);
  const titleStyle = active?.style ?? session.titleStyle;
  const setTitleStyle = (style: typeof titleStyle) =>
    active
      ? session.updateTextLayer(active.id, { style })
      : session.setTitleStyle(style);
  const titlePosition = active
    ? { x: active.x, y: active.y, auto: false }
    : session.titlePosition;
  const setTitlePosition = (position: {
    x: number;
    y: number;
    auto?: boolean;
  }) =>
    active
      ? session.updateTextLayer(active.id, {
          x: Math.min(95, position.x),
          y: Math.min(95, position.y),
        })
      : session.setTitlePosition(position);
  const style = titleStyle ?? DEFAULT_TITLE_STYLE;
  return (
    <fieldset className="text-style-card" disabled={readOnly}>
      <legend className="sr-only">Title, font and text style</legend>
      <div className="text-style-heading">
        <span>
          <Type size={17} /> Say it your way
        </span>
        <small>Changes appear on your print instantly</small>
      </div>
      <div
        className="text-layer-picker"
        role="group"
        aria-label="Choose text to edit"
      >
        <button aria-pressed={!active} onClick={() => onSelectText(null)}>
          Footer caption
        </button>
        {session.textLayers.map((layer, i) => (
          <button
            key={layer.id}
            aria-pressed={active?.id === layer.id}
            onClick={() => onSelectText(layer.id)}
          >
            {layer.text.slice(0, 16) || `Text ${i + 1}`}
          </button>
        ))}
        <button
          disabled={session.textLayers.length >= 12}
          onClick={() => {
            const id = crypto.randomUUID();
            session.addTextLayer({
              id,
              text: "Your text",
              x: 50,
              y: 50,
              width: 65,
              fontSize: 72,
              rotation: 0,
              style: {
                ...DEFAULT_TITLE_STYLE,
                font: "modern",
                color: "#ffffff",
                bold: true,
              },
            });
            onSelectText(id);
            requestAnimationFrame(() => {
              const input = document.getElementById(
                "studio-text-input",
              ) as HTMLInputElement | null;
              input?.focus();
              input?.select();
            });
          }}
        >
          <Plus size={14} /> Add text
        </button>
        {active && (
          <button
            className="text-delete-layer"
            aria-label="Delete selected text"
            onClick={() => {
              session.removeTextLayer(active.id);
              onSelectText(null);
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {active && (
        <p className="text-layer-tip">
          Drag this text on the print. Use its corner to resize and its top
          handle to rotate. Double-click to edit.
        </p>
      )}
      <label className="text-title-label">
        {active ? "Your text" : "Footer caption"}
        <input
          id="studio-text-input"
          maxLength={200}
          value={stripTitle}
          placeholder="Give this memory a name…"
          onChange={(e) => setStripTitle(e.target.value)}
        />
      </label>
      <div
        className="text-preset-row"
        role="group"
        aria-label="Quick text styles"
      >
        {TEXT_STYLE_PRESETS.map((preset) => (
          <button
            key={preset.name}
            aria-pressed={
              JSON.stringify(style) === JSON.stringify(preset.style)
            }
            onClick={() => setTitleStyle({ ...preset.style })}
          >
            <span
              style={{
                fontFamily: titleFont(preset.style.font),
                fontStyle: preset.style.italic ? "italic" : "normal",
                fontWeight: preset.style.bold ? 700 : 400,
              }}
            >
              {preset.sample}
            </span>
            <small>{preset.name}</small>
          </button>
        ))}
      </div>
      <div className="text-format-toolbar">
        <label>
          Font
          <select
            value={style.font}
            onChange={(e) =>
              setTitleStyle({
                ...style,
                font: e.target.value as typeof style.font,
              })
            }
          >
            {TITLE_FONTS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.name}
              </option>
            ))}
          </select>
        </label>
        <div
          className="text-format-toggles"
          role="group"
          aria-label="Text emphasis"
        >
          <button
            aria-label="Bold"
            aria-pressed={style.bold}
            onClick={() => setTitleStyle({ ...style, bold: !style.bold })}
          >
            <Bold size={16} />
          </button>
          <button
            aria-label="Italic"
            aria-pressed={style.italic}
            onClick={() => setTitleStyle({ ...style, italic: !style.italic })}
          >
            <Italic size={16} />
          </button>
        </div>
        <label className="text-size-control">
          Size{" "}
          <output>
            {active
              ? `${Math.round(active.fontSize * style.size)} px`
              : `${Math.round(style.size * 100)}%`}
          </output>
          <input
            type="range"
            min={active ? 16 : 60}
            max={active ? 200 : 160}
            step={active ? 1 : 5}
            value={active ? active.fontSize * style.size : style.size * 100}
            onChange={(e) =>
              active
                ? session.updateTextLayer(active.id, {
                    fontSize: Number(e.target.value) / style.size,
                  })
                : setTitleStyle({
                    ...style,
                    size: Number(e.target.value) / 100,
                  })
            }
          />
        </label>
        <div className="text-color-controls">
          <span>Color</span>
          <div>
            <button
              aria-pressed={style.color === "auto"}
              onClick={() => setTitleStyle({ ...style, color: "auto" })}
            >
              Auto
            </button>
            <label className="text-color-swatch" title="Choose text color">
              <span className="sr-only">Text color</span>
              <input
                type="color"
                value={style.color === "auto" ? "#333333" : style.color}
                onChange={(e) =>
                  setTitleStyle({ ...style, color: e.target.value })
                }
              />
            </label>
          </div>
        </div>
        <button
          className="text-reset-style"
          onClick={() => setTitleStyle({ ...DEFAULT_TITLE_STYLE })}
        >
          <RotateCcw size={14} /> Reset style
        </button>
      </div>
      <details className="text-placement">
        <summary>Adjust text placement</summary>
        <div>
          <label>
            Horizontal position
            <input
              type="range"
              min="5"
              max="99"
              value={titlePosition.x}
              onChange={(e) =>
                setTitlePosition({
                  ...titlePosition,
                  x: Number(e.target.value),
                  auto: false,
                })
              }
            />
          </label>
          <label>
            Vertical position
            <input
              type="range"
              min="5"
              max="99"
              value={titlePosition.y}
              onChange={(e) =>
                setTitlePosition({
                  ...titlePosition,
                  y: Number(e.target.value),
                  auto: false,
                })
              }
            />
          </label>
          <button
            onClick={() => setTitlePosition({ x: 50, y: 90, auto: true })}
          >
            Reset placement
          </button>
        </div>
      </details>
      {readOnly && (
        <p>
          The host styles the shared caption. You’ll see their changes here.
        </p>
      )}
    </fieldset>
  );
}
