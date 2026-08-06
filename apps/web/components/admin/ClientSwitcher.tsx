"use client";

import { useEffect, useState, useCallback } from "react";
import { getSessionToken } from "../../lib/api-client";

type ClientOption = { id: string; name: string };

type ClientSwitcherProps = {
  moduleKey: string;
  selectedClientId: string | null;
  onSelect: (clientId: string) => void;
};

const API_BASE = "http://localhost:3003/api";

export default function ClientSwitcher({
  moduleKey,
  selectedClientId,
  onSelect,
}: ClientSwitcherProps) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Fetch clients list once
  useEffect(() => {
    if (loaded) return;
    const token = getSessionToken();
    if (!token) return;
    fetch(`${API_BASE}/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.clients) setClients(data.clients);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [loaded]);

  // Set initial search value from selected client
  useEffect(() => {
    const current = clients.find((c) => c.id === selectedClientId);
    if (current && !search) setSearch(current.name);
  }, [clients, selectedClientId, search]);

  const handlePick = useCallback(
    (name: string) => {
      const match = clients.find((c) => c.name === name);
      if (match && match.id !== selectedClientId) {
        onSelect(match.id);
      }
    },
    [clients, selectedClientId, onSelect],
  );

  const filtered = search
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      )
    : clients;

  return (
    <div style={{ marginBottom: 18 }}>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink-soft)",
          marginBottom: 6,
        }}
      >
        Cliente
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          list={`admin-client-list-${moduleKey}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handlePick(search);
            }
          }}
          placeholder="Escribe un nombre..."
          style={{
            flex: 1,
            height: 44,
            borderRadius: "var(--radius)",
            border: "1px solid var(--line)",
            padding: "0 14px",
            fontSize: 14,
            background: "var(--paper)",
            color: "var(--ink)",
            outline: "none",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--gold)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--line)";
          }}
        />
        <button
          type="button"
          onClick={() => handlePick(search)}
          style={{
            height: 44,
            padding: "0 16px",
            borderRadius: "9999px",
            border: "1px solid var(--line)",
            background: "var(--paper)",
            color: "var(--ink-soft)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Buscar
        </button>
      </div>
      <datalist id={`admin-client-list-${moduleKey}`}>
        {filtered.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      {selectedClientId && (
        <p
          style={{
            fontSize: 11,
            color: "var(--sage)",
            marginTop: 6,
            fontWeight: 500,
          }}
        >
          ✓ Cliente seleccionado
        </p>
      )}
    </div>
  );
}
