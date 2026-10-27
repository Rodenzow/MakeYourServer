"use client";

import type { ServerSpec } from "@mys/core";
import { RoleList, ServerTree } from "../server-tree";
import { specToTree } from "../spec/spec-tree";

export function BackupTree({ spec }: { spec: ServerSpec }) {
  return (
    <div className="space-y-4">
      <ServerTree name={spec.meta.name} categories={specToTree(spec)} animate={false} />
      <RoleList roles={spec.roles.map((r) => ({ key: r.id, name: r.name, color: r.color }))} />
    </div>
  );
}
