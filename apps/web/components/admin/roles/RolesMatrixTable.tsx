"use client";

import { useEffect, useState } from "react";
import { CLIENT_TYPES } from "@latribu/shared-types";
import type { PermissionModuleDto, ModuleAccessMatrix } from "@latribu/shared-types";
import { CLIENT_TYPE_LABELS } from "../../../lib/constants";
import { saveMatrixColumn, deleteModule } from "../../../lib/roles-client";
import { showToast } from "../../layout/AppShell";

type RolesMatrixTableProps = {
  modules: PermissionModuleDto[];
  matrix: ModuleAccessMatrix;
  onSaved: () => void;
};

const cellStyle: React.CSSProperties = { padding: "10px 12px", textAlign: "center" };

export default function RolesMatrixTable({ modules, matrix, onSaved }: RolesMatrixTableProps) {
  const [edits, setEdits] = useState<ModuleAccessMatrix>(matrix);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  async function handleDelete(module: PermissionModuleDto) {
    if (!window.confirm(`¿Borrar el módulo "${module.label}"? Esto quita el acceso configurado para todos los tipos de cliente.`)) return;
    setDeletingKey(module.key);
    try {
      await deleteModule(module.key);
      showToast("Módulo eliminado.", "success");
      onSaved();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error al borrar el módulo.", "error");
    } finally {
      setDeletingKey(null);
    }
  }

  // La matriz llega async (fetch inicial, y de nuevo tras agregar un
  // módulo) — cada vez que cambia la referencia se resincroniza el estado
  // editable local con lo que hay guardado.
  useEffect(() => {
    setEdits(matrix);
  }, [matrix]);

  function toggle(clientType: string, moduleKey: string) {
    setEdits((prev) => ({
      ...prev,
      [clientType]: { ...prev[clientType], [moduleKey]: !prev[clientType]?.[moduleKey] },
    }));
  }

  async function handleSave(clientType: string) {
    const columnEdits = edits[clientType] ?? {};
    // Si ambas variantes de Información Personal quedarían marcadas, se
    // avisa antes de guardar — el sistema igual aplica Mentoring como la
    // efectiva (superset) si el admin confirma.
    if (columnEdits.personal_info && columnEdits.personal_info_mentoring) {
      const confirmed = window.confirm(
        'Este tipo de cliente tendría ambas variantes de Baseline activas — el sistema aplicará la variante Premium por defecto si ambas están marcadas, ya que incluye el acceso base más Dispositivos y Laboratorios. ¿Confirmas?'
      );
      if (!confirmed) return;
    }
    setSavingType(clientType);
    try {
      await saveMatrixColumn(clientType, columnEdits);
      showToast("Cambios guardados.", "success");
      onSaved();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error al guardar los cambios.", "error");
    } finally {
      setSavingType(null);
    }
  }

  return (
    <div style={{
      background: "var(--eph-surface)", border: "1px solid var(--eph-line)",
      borderRadius: "0", padding: "22px 24px",
    }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--eph-line)" }}>
              <th style={{ ...cellStyle, textAlign: "left", color: "var(--eph-muted)", fontWeight: 600 }}>Módulo</th>
              {CLIENT_TYPES.map((clientType) => (
                <th
                  key={clientType}
                  style={{
                    ...cellStyle,
                    fontWeight: 700,
                    color: "var(--eph-text)",
                    background: clientType === "mentoring" ? "rgba(201,166,107,.14)" : undefined,
                  }}
                >
                  {CLIENT_TYPE_LABELS[clientType] ?? clientType}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((module, i) => (
              <tr key={module.key} style={{ borderBottom: i < modules.length - 1 ? "0.5px solid var(--eph-line)" : "none" }}>
                <td style={{ ...cellStyle, textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 600, color: "var(--eph-text)" }}>{module.label}</div>
                    {module.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDelete(module)}
                        disabled={deletingKey === module.key}
                        className="font-mono"
                        style={{
                          background: "none", border: "1px solid var(--eph-danger)", borderRadius: 999,
                          padding: "3px 12px", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "#D99483",
                          cursor: deletingKey === module.key ? "not-allowed" : "pointer",
                          opacity: deletingKey === module.key ? 0.6 : 1, flexShrink: 0,
                        }}
                      >
                        {deletingKey === module.key ? "Borrando…" : "Eliminar"}
                      </button>
                    )}
                  </div>
                  {module.note && <div style={{ fontSize: 11, color: "var(--eph-muted)", marginTop: 2 }}>{module.note}</div>}
                </td>
                {CLIENT_TYPES.map((clientType) => (
                  <td
                    key={clientType}
                    style={{ ...cellStyle, background: clientType === "mentoring" ? "rgba(201,166,107,.14)" : undefined }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`${module.label} — ${CLIENT_TYPE_LABELS[clientType] ?? clientType}`}
                      checked={!!edits[clientType]?.[module.key]}
                      onChange={() => toggle(clientType, module.key)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={cellStyle} />
              {CLIENT_TYPES.map((clientType) => {
                const isMentoring = clientType === "mentoring";
                return (
                  <td key={clientType} style={{ ...cellStyle, background: isMentoring ? "rgba(201,166,107,.14)" : undefined }}>
                    <button
                      type="button"
                      disabled={savingType === clientType}
                      onClick={() => handleSave(clientType)}
                      className="font-mono"
                      style={{
                        borderRadius: 0,
                        padding: "7px 18px",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        cursor: savingType === clientType ? "not-allowed" : "pointer",
                        opacity: savingType === clientType ? 0.6 : 1,
                        border: isMentoring ? "none" : "1px solid var(--eph-line-2)",
                        background: isMentoring ? "var(--eph-accent)" : "transparent",
                        color: isMentoring ? "var(--eph-ink)" : "var(--eph-body)",
                      }}
                    >
                      {savingType === clientType ? "Guardando…" : "Guardar"}
                    </button>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
