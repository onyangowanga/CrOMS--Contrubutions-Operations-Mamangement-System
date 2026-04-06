export default function Panel({ title, subtitle, children, actions }) {
  return (
    <article className="panel">
      <div className="panel-head panel-head-row">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </div>
      {children}
    </article>
  );
}
