import React from "react";
export default function Sources({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="sources">
      {sources.map((source, index) => (
        <a key={source.url || index} href={source.url} target="_blank" rel="noreferrer">
          {index + 1}. {source.title || source.url}
        </a>
      ))}
    </div>
  );
}
