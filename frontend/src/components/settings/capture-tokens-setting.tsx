"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { type FormEvent, useState, useSyncExternalStore } from "react";

import { fieldClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateIntegrationToken,
  useIntegrationTokens,
  useRevokeIntegrationToken,
} from "@/hooks/use-integration-tokens";
import { useNow } from "@/hooks/use-now";
import { formatRelativeSeconds } from "@/lib/time";
import type { IntegrationToken, IntegrationTokenCreated } from "@/lib/types/integrations";
import { cn } from "@/lib/utils";

const noSubscribe = () => () => {};

function useCaptureUrl(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => `${window.location.origin}/api/v1/capture`,
    () => "/api/v1/capture",
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      aria-label={label}
      onClick={() =>
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function NewToken({ created, onDone }: { created: IntegrationTokenCreated; onDone: () => void }) {
  const captureUrl = useCaptureUrl();
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
    >
      <p className="text-sm">
        Token for <span className="font-medium">{created.name}</span>. Copy it now: Ethos keeps only
        a fingerprint and cannot show it again.
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs">
          {created.token}
        </code>
        <CopyButton value={created.token} label="Copy token" />
      </div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          POST {captureUrl}
        </code>
        <CopyButton value={captureUrl} label="Copy capture URL" />
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function TokenRow({ token, now }: { token: IntegrationToken; now: Date | null }) {
  const revoke = useRevokeIntegrationToken();
  const [confirming, setConfirming] = useState(false);
  const revoked = token.revoked_at !== null;
  const used = token.last_used_at
    ? `used ${now ? formatRelativeSeconds(new Date(token.last_used_at), now) : ""}`
    : "never used";

  return (
    <li className={cn("flex flex-wrap items-center gap-3 py-3", revoked && "opacity-60")}>
      <KeyRound className="size-4 text-faint" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{token.name}</p>
        <p className="font-mono text-[0.6875rem] text-faint">
          {token.prefix}… · {revoked ? "revoked" : used}
        </p>
      </div>
      {!revoked &&
        (confirming ? (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Stop accepting it?</span>
            <Button variant="ghost" size="xs" onClick={() => setConfirming(false)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              size="xs"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate(token.id)}
            >
              Revoke
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="xs" onClick={() => setConfirming(true)}>
            Revoke
          </Button>
        ))}
      {revoke.isError && (
        <p role="alert" className="w-full text-xs text-destructive">
          Couldn&apos;t revoke: {revoke.error.message}.
        </p>
      )}
    </li>
  );
}

export function CaptureTokensSetting() {
  const tokens = useIntegrationTokens();
  const create = useCreateIntegrationToken();
  const now = useNow();
  const [name, setName] = useState("iPhone Shortcut");
  const [created, setCreated] = useState<IntegrationTokenCreated | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate(name.trim(), { onSuccess: setCreated });
  }

  return (
    <div className="flex flex-col gap-4 pt-3">
      <p className="text-sm text-muted-foreground">
        A token lets a Shortcut add captures without signing in. It can do nothing else, and you can
        revoke it at any time. Clear commands such as{" "}
        <code className="font-mono text-xs">/task … by fri</code> run; everything else lands in the
        Inbox.
      </p>

      {created ? (
        <NewToken created={created} onDone={() => setCreated(null)} />
      ) : (
        <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
          <label htmlFor="token-name" className="sr-only">
            Token name
          </label>
          <input
            id="token-name"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={cn(fieldClass, "w-56")}
          />
          <Button type="submit" size="sm" variant="outline" disabled={create.isPending}>
            Create token
          </Button>
          {create.isError && (
            <p role="alert" className="w-full text-xs text-destructive">
              Couldn&apos;t create: {create.error.message}.
            </p>
          )}
        </form>
      )}

      {tokens.isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : tokens.isError ? (
        <p className="text-xs text-destructive">Tokens unavailable: {tokens.error.message}</p>
      ) : tokens.data.length > 0 ? (
        <ul className="divide-y divide-border border-y border-border">
          {tokens.data.map((token) => (
            <TokenRow key={token.id} token={token} now={now} />
          ))}
        </ul>
      ) : null}

      <details className="text-sm text-muted-foreground">
        <summary className="cursor-pointer text-foreground outline-none focus-visible:underline">
          Setting up the iPhone Shortcut
        </summary>
        <ol className="mt-2 ml-5 list-decimal space-y-1">
          <li>In Shortcuts, add “Ask for Input” (Text).</li>
          <li>
            Add “Get Contents of URL” with the capture URL, method POST, header{" "}
            <code className="font-mono text-xs">Authorization: Bearer &lt;token&gt;</code>, and a
            JSON body with <code className="font-mono text-xs">text</code> set to the input.
          </li>
          <li>
            Add “Get Dictionary Value” for <code className="font-mono text-xs">message</code> and
            “Show Notification” with it. A missing message means nothing was saved.
          </li>
        </ol>
      </details>
    </div>
  );
}
