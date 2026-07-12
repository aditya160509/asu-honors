"use client";

import * as React from "react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/layout/AuthContext";
import { useConfigParameters, useInjectEvent, useUpdateConfig } from "@/lib/api/hooks/useAdmin";

function ConfigEditor() {
  const { data, isLoading, isError, refetch } = useConfigParameters();
  const updateConfig = useUpdateConfig();
  const [edits, setEdits] = React.useState<Record<string, string>>({});

  if (isLoading) return <Skeleton width="100%" height={240} />;
  if (isError) return <ErrorState message="Could not load config." onRetry={() => refetch()} />;
  if (!data || data.length === 0) return <EmptyState title="No config parameters found." />;

  return (
    <table className="table-dense w-full">
      <thead>
        <tr>
          <th className="text-left">Key</th>
          <th className="text-left">Value</th>
          <th className="text-left">Description</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {data.map((cp) => (
          <tr key={cp.key}>
            <td className="num text-text-primary">{cp.key}</td>
            <td>
              <Input
                className="w-28"
                value={edits[cp.key] ?? cp.value}
                onChange={(e) => setEdits((prev) => ({ ...prev, [cp.key]: e.target.value }))}
              />
            </td>
            <td className="text-text-secondary text-small">{cp.description}</td>
            <td>
              <Button
                size="sm"
                variant="outline"
                disabled={updateConfig.isPending || edits[cp.key] === undefined || edits[cp.key] === cp.value}
                onClick={() =>
                  updateConfig.mutate({ key: cp.key, value: edits[cp.key], scope: cp.scope, scope_id: cp.scope_id })
                }
              >
                Save
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EventInjector() {
  const injectEvent = useInjectEvent();
  const [eventId, setEventId] = React.useState("");
  const [scopeType, setScopeType] = React.useState("company");
  const [scopeRef, setScopeRef] = React.useState("");

  function handleInject() {
    if (!eventId || !scopeRef) return;
    injectEvent.mutate({ event_id: Number(eventId), scope_type: scopeType, scope_ref: Number(scopeRef) });
  }

  return (
    <div className="flex flex-col gap-3">
      <Input placeholder="Event ID" value={eventId} onChange={(e) => setEventId(e.target.value)} />
      <Input placeholder="Scope type (company | industry | market)" value={scopeType} onChange={(e) => setScopeType(e.target.value)} />
      <Input placeholder="Scope ref (id)" value={scopeRef} onChange={(e) => setScopeRef(e.target.value)} />
      <Button onClick={handleInject} disabled={injectEvent.isPending || !eventId || !scopeRef}>
        {injectEvent.isPending ? "Injecting…" : "Inject Event"}
      </Button>
      {injectEvent.isSuccess && <p className="text-small text-positive">Event injected.</p>}
      {injectEvent.isError && <p className="text-small text-negative">{(injectEvent.error as Error)?.message}</p>}
    </div>
  );
}

export default function AdminPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <TerminalShell>
        <Skeleton width="100%" height={200} />
      </TerminalShell>
    );
  }

  if (user && user.role !== "admin") {
    return (
      <TerminalShell>
        <EmptyState title="Admin access required." description="Your account does not have the admin role." />
      </TerminalShell>
    );
  }

  return (
    <TerminalShell>
      <h1 className="text-h2 font-semibold text-text-primary mb-4">Admin</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Config Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <ConfigEditor />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Inject Event</CardTitle>
          </CardHeader>
          <CardContent>
            <EventInjector />
          </CardContent>
        </Card>
      </div>
    </TerminalShell>
  );
}
