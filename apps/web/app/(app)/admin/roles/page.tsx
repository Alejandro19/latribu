"use client";

import { useCallback, useEffect, useState } from "react";
import IdentityHeader from "../../../../components/ui/IdentityHeader";
import RolesCountCards from "../../../../components/admin/roles/RolesCountCards";
import RolesMatrixTable from "../../../../components/admin/roles/RolesMatrixTable";
import { getMatrix, getCounts } from "../../../../lib/roles-client";
import type { PermissionModuleDto, ModuleAccessMatrix, ClientTypeCounts } from "@latribu/shared-types";

export default function AdminRolesPage() {
  const [modules, setModules] = useState<PermissionModuleDto[]>([]);
  const [matrix, setMatrix] = useState<ModuleAccessMatrix>({});
  const [counts, setCounts] = useState<ClientTypeCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    getMatrix()
      .then(({ modules, matrix }) => {
        setModules(modules);
        setMatrix(matrix);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar la matriz de permisos."));
    getCounts()
      .then(setCounts)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <div>
      <IdentityHeader
        title="Roles y perfiles"
        subtitle="Marca los módulos a los que tiene acceso cada tipo de cliente y guarda los cambios."
      />
      <RolesCountCards counts={counts} />
      {error && (
        <p role="alert" style={{ color: "#D99483", fontSize: 13, marginBottom: 16 }}>
          {error}
        </p>
      )}
      <RolesMatrixTable modules={modules} matrix={matrix} onSaved={refetch} />
    </div>
  );
}
