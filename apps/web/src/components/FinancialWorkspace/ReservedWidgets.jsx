import React from 'react';

/**
 * Reserved Widgets container.
 * Hidden by default when empty (no children / no items).
 */
export default function ReservedWidgets({ title = 'Widgets', items, children }) {
  const hasItems = Array.isArray(items) && items.length > 0;
  const hasChildren = React.Children.count(children) > 0;

  if (!hasItems && !hasChildren) return null;

  return (
    <section className="fw-reserved-panel fw-widgets" aria-label={title}>
      <h2 className="fw-reserved-panel-title">{title}</h2>
      <div className="fw-reserved-panel-body">
        {hasChildren
          ? children
          : items.map((item) => (
              <div key={item.id} className="fw-reserved-panel-item">
                {item.label}
              </div>
            ))}
      </div>
    </section>
  );
}
