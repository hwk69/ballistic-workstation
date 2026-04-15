import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import WidgetCard from "./WidgetCard.jsx";

export default function WidgetGrid({ items, onReorder, onRemove, onToggleSpan, registry, renderWidget }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.key === active.id);
    const newIndex = items.findIndex((item) => item.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.key)} strategy={verticalListSortingStrategy}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((item) => {
            const def = registry[item.key];
            if (!def) return null;
            return (
              <WidgetCard
                key={item.key}
                id={item.key}
                label={def.label}
                span={item.span}
                onRemove={() => onRemove(item.key)}
                onToggleSpan={() => onToggleSpan(item.key)}>
                {renderWidget(item.key)}
              </WidgetCard>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
