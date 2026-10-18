import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { KEEPSAKE_TEMPLATES } from "../../data/keepsakeTemplates";
import { ALL_DESIGNS } from "../../data/themePacks";
import { useSessionStore } from "../../state/useSessionStore";
import { designBackground } from "../design/designBackground";
import { getLayout } from "../../data/stripLayouts";

export default function TemplatePicker() {
  const [category, setCategory] = useState("All");
  const state = useSessionStore();
  return (
    <section
      className="keepsake-template-picker"
      aria-labelledby="keepsake-templates-title"
    >
      <header className="template-picker-heading">
        <Sparkles size={18} />
        <span>
          <h2 id="keepsake-templates-title">Ready-made templates</h2>
          <small>
            8 keepsakes for birthdays, graduation, couples, friendship & events
          </small>
        </span>
      </header>
      <div
        className="template-categories"
        role="group"
        aria-label="Template categories"
      >
        {["All", "Birthdays", "Graduation", "Couples", "Friends", "Events"].map(
          (name) => (
            <button
              key={name}
              aria-pressed={category === name}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ),
        )}
      </div>
      <div className="template-grid">
        {KEEPSAKE_TEMPLATES.filter(
          (template) => category === "All" || template.category === category,
        ).map((template) => {
          const design = ALL_DESIGNS.find((d) => d.id === template.designId)!;
          const layout = getLayout(template.layoutId);
          const selected =
            state.layoutId === template.layoutId &&
            state.designPreset?.id === template.designId &&
            state.stripTitle === template.title;
          return (
            <button
              key={template.id}
              className="keepsake-template"
              aria-pressed={selected}
              onClick={() => {
                state.setLayoutId(template.layoutId);
                useSessionStore.setState({
                  designPreset: { ...design, edgeStyle: "rounded" },
                  filterId: template.filterId,
                  stripTitle: template.title,
                  titleStyle: { ...template.titleStyle },
                  titlePosition: { x: 50, y: 90, auto: true },
                  customLayout: null,
                  assignedPhotos: [],
                  photoEdits: [],
                  photoSources: [],
                  textLayers: [],
                  placedStickers: [],
                  drawStrokes: [],
                });
              }}
            >
              <div className="template-art">
                <div
                  style={{
                    ...designBackground(design),
                    aspectRatio: layout.stripAspectRatio,
                    display: "grid",
                    gridTemplateColumns: `repeat(${layout.columns},1fr)`,
                    gridTemplateRows: `repeat(${layout.rows},1fr)`,
                    gap: 3,
                    padding: "7px 7px 17px",
                  }}
                >
                  {layout.slots.map((slot) => (
                    <span
                      key={slot.index}
                      style={{
                        gridColumn: `${slot.col + 1}/span ${slot.colSpan}`,
                        gridRow: `${slot.row + 1}/span ${slot.rowSpan}`,
                      }}
                    />
                  ))}
                </div>
                {selected && (
                  <span className="template-selected">
                    <Check size={14} />
                  </span>
                )}
              </div>
              <strong>{template.name}</strong>
              <small>{template.description}</small>
              <span className="template-meta">
                {layout.slotCount} photos · {template.category}
              </span>
            </button>
          );
        })}
      </div>
      <p>
        Includes a layout, frame, caption and filter. You can customize all of
        them next.
      </p>
    </section>
  );
}
