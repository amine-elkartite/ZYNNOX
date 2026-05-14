import React, { useState } from "react";
import DataList from "../components/common/DataList.jsx";
import PageTitle from "../components/common/PageTitle.jsx";
import { useLoad } from "../hooks/useLoad.js";

export default function HistoryPage() {
  const [selectedId, setSelectedId] = useState("");
  const [history] = useLoad("/api/conversations");
  const [detail] = useLoad(selectedId ? `/api/conversations/${selectedId}` : null);
  const conversation = detail?.conversation;

  return (
    <main className="page">
      <PageTitle title="Conversations" subtitle="Review conversations and sourced agent outputs." />
      <div className="detail-layout">
        <div className="panel">
          <h3>History</h3>
          <DataList
            items={history?.conversations || []}
            render={(item) => (
              <>
                <strong>{item.title}</strong>
                <span>{item.messages?.length || 0} messages</span>
                <button className="ghost small-row-action" onClick={() => setSelectedId(item.id)}>Open</button>
              </>
            )}
          />
        </div>
        <div className="panel">
          <h3>Detail</h3>
          {!selectedId && <span className="coming-soon">Select a conversation</span>}
          {selectedId && !conversation && <span className="coming-soon">Loading conversation</span>}
          {conversation && (
            <div className="data-list">
              <strong>{conversation.title}</strong>
              {(conversation.messages || []).map((message) => (
                <div className="message" key={message.id}>
                  <strong>{message.role}</strong>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
