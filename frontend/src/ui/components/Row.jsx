import React from 'react';

export function Row({ title, subtitle, items, renderItem }) {
  return (
    <section className="section">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          {subtitle ? <div className="sub">{subtitle}</div> : null}
        </div>
      </div>

      <div className="row">
        {(items ?? []).map((it) => renderItem(it))}
      </div>
    </section>
  );
}
