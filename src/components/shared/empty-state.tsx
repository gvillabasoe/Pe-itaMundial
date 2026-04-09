interface EmptyStateProps {
  title: string;
  text?: string;
}

export function EmptyState({ title, text }: EmptyStateProps) {
  return (
    <div className="emptyState" role="status">
      <strong>{title}</strong>
      {text ? <p>{text}</p> : null}
    </div>
  );
}
