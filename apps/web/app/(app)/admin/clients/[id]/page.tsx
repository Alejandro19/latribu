"use client";

import { useParams } from "next/navigation";
import AdminClientDetail from "@/components/admin/AdminClientDetail";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  return <AdminClientDetail clientId={params.id} />;
}
