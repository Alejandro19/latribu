"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import { fetchClients } from "../../lib/clients-client";

type ClientOption = { id: string; name: string };

type ClientSwitcherProps = {
  moduleKey: string;
  selectedClientId: string | null;
  onSelect: (clientId: string) => void;
};

export default function ClientSwitcher({
  moduleKey,
  selectedClientId,
  onSelect,
}: ClientSwitcherProps) {
  // Clave de caché compartida entre todos los módulos admin (Entrenamiento,
  // Nutrición, Cortisol, etc.) — cambiar de módulo ya no vuelve a pedir la
  // lista completa de clientes, SWR la sirve desde caché al instante y
  // revalida en segundo plano. Usa el mismo helper (lib/clients-client.ts,
  // NEXT_PUBLIC_API_BASE_URL) que el resto de la app en vez de un fetch
  // propio con "localhost:3003" hardcodeado, que fallaba fuera de dev local.
  const { data: clients = [] } = useSWR<ClientOption[]>("admin-clients-list", fetchClients, {
    revalidateOnFocus: false,
  });
  const [search, setSearch] = useState("");

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
        className="font-mono"
        style={{
          display: "block",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          fontWeight: 400,
          color: "var(--eph-muted)",
          marginBottom: 8,
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
          className="font-body"
          style={{
            flex: 1,
            height: 36,
            borderRadius: 0,
            border: "none",
            borderBottom: "1px solid var(--eph-line-2)",
            padding: "0 2px 6px",
            fontSize: 16,
            fontWeight: 400,
            background: "transparent",
            color: "var(--eph-text)",
            outline: "none",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderBottomColor = "var(--eph-accent)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderBottomColor = "var(--eph-line-2)";
          }}
        />
        <button
          type="button"
          onClick={() => handlePick(search)}
          className="font-mono"
          style={{
            height: 44,
            padding: "0 18px",
            borderRadius: 0,
            border: "1px solid var(--eph-line-2)",
            background: "transparent",
            color: "var(--eph-body)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
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
          className="font-mono"
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--eph-accent)",
            marginTop: 8,
            fontWeight: 400,
          }}
        >
          ✓ Cliente seleccionado
        </p>
      )}
    </div>
  );
}
