"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Icon } from "@/components/brand/icon";
import {
  LEAD_DAY_PRESETS,
  TIMEZONE_OPTIONS,
} from "@/lib/reminders/presets";

import { saveReminderPreferences } from "./actions";

type Preset = keyof typeof LEAD_DAY_PRESETS;

export function RemindersForm({
  initial,
  defaultEmail,
  authorizationGranted,
}: {
  initial: {
    email_enabled: boolean;
    email_address: string;
    preset: Preset | "custom";
    customDays: number[];
    timezone: string;
    auto_request_records: boolean;
    auto_request_lead_days: number;
  };
  defaultEmail: string;
  authorizationGranted: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [emailEnabled, setEmailEnabled] = useState(initial.email_enabled);
  const [emailAddress, setEmailAddress] = useState(initial.email_address);
  const [preset, setPreset] = useState<Preset>(
    initial.preset === "custom" ? "standard" : initial.preset,
  );
  const [timezone, setTimezone] = useState(initial.timezone);
  const [autoRequest, setAutoRequest] = useState(
    initial.auto_request_records && authorizationGranted,
  );
  const [autoRequestLeadDays, setAutoRequestLeadDays] = useState(
    initial.auto_request_lead_days,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveReminderPreferences({
        email_enabled: emailEnabled,
        email_address: emailAddress,
        preset,
        timezone,
        auto_request_records: autoRequest && authorizationGranted,
        auto_request_lead_days: autoRequestLeadDays,
      });
      if (res.ok) {
        toast.success("Reminder preferences saved.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {initial.preset === "custom" && (
        <div
          style={{
            padding: "10px 12px",
            background: "var(--pw-pending-bg)",
            color: "var(--pw-pending-fg)",
            borderRadius: 8,
            font: "400 12.5px var(--font-inter)",
          }}
        >
          Your saved lead days{" "}
          <span className="mono" style={{ fontWeight: 500 }}>
            [{initial.customDays.join(", ")}]
          </span>{" "}
          don&apos;t match a preset. Picking a preset below will overwrite them.
        </div>
      )}

      {/* Email enable toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          className="pw-switch"
          data-on={emailEnabled ? "true" : "false"}
          onClick={() => setEmailEnabled((v) => !v)}
          aria-pressed={emailEnabled}
          aria-label="Toggle reminder emails"
        />
        <div>
          <div style={{ font: "500 13.5px var(--font-inter)", color: "var(--pw-text)" }}>
            Reminder emails
          </div>
          <div style={{ font: "400 12px var(--font-inter)", color: "var(--pw-text-muted)" }}>
            {emailEnabled
              ? "On · Pawdex will email you ahead of expiring vaccines."
              : "Off — no reminder emails will be sent."}
          </div>
        </div>
      </div>

      {/* Email override */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          htmlFor="email_address"
          style={{
            font: "500 11px var(--font-inter)",
            color: "var(--pw-text-muted)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Send reminders to
        </label>
        <input
          id="email_address"
          type="email"
          placeholder={defaultEmail || "your@email.com"}
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          style={inputStyle}
        />
        <div style={{ font: "400 11.5px var(--font-inter)", color: "var(--pw-text-muted)" }}>
          Leave blank to use your sign-in email
          {defaultEmail ? (
            <>
              {" "}(<span className="mono">{defaultEmail}</span>)
            </>
          ) : null}
          .
        </div>
      </div>

      {/* Lead-day preset */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            font: "500 11px var(--font-inter)",
            color: "var(--pw-text-muted)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Reminder cadence
        </div>
        <div
          role="radiogroup"
          aria-label="Reminder cadence"
          style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
        >
          {(Object.keys(LEAD_DAY_PRESETS) as Preset[]).map((key) => {
            const p = LEAD_DAY_PRESETS[key];
            const on = preset === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPreset(key)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 10,
                  border: `1px solid ${on ? "var(--pw-accent)" : "var(--pw-border)"}`,
                  background: on ? "var(--pw-accent-soft)" : "var(--pw-surface)",
                  cursor: "pointer",
                  color: "var(--pw-text)",
                }}
              >
                <div style={{ font: "600 13px var(--font-inter)" }}>{p.label}</div>
                <div
                  className="mono"
                  style={{
                    font: "400 11.5px var(--font-jetbrains)",
                    color: "var(--pw-text-muted)",
                    marginTop: 4,
                  }}
                >
                  {p.days.join(" / ")} days before
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Timezone */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          htmlFor="timezone"
          style={{
            font: "500 11px var(--font-inter)",
            color: "var(--pw-text-muted)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Timezone
        </label>
        <select
          id="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          style={inputStyle}
        >
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <div style={{ font: "400 11.5px var(--font-inter)", color: "var(--pw-text-muted)" }}>
          Reminders are computed daily at ~8am in this zone (cron runs at 13:00 UTC).
        </div>
      </div>

      {/* Auto-request records toggle */}
      <div
        style={{
          paddingTop: 16,
          borderTop: "1px solid var(--pw-border)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            className="pw-switch"
            data-on={autoRequest ? "true" : "false"}
            onClick={() =>
              authorizationGranted && setAutoRequest((v) => !v)
            }
            aria-pressed={autoRequest}
            aria-label="Toggle auto-request records"
            disabled={!authorizationGranted}
            style={{
              opacity: authorizationGranted ? 1 : 0.4,
              cursor: authorizationGranted ? "pointer" : "not-allowed",
            }}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                font: "500 13.5px var(--font-inter)",
                color: "var(--pw-text)",
              }}
            >
              Auto-request SOAP notes after every visit
            </div>
            <div
              style={{
                font: "400 12px var(--font-inter)",
                color: "var(--pw-text-muted)",
                marginTop: 2,
              }}
            >
              {authorizationGranted
                ? "Whenever a vet visit is logged with a clinic email on file, Pawdex queues a records-request email for the day after the visit."
                : (
                  <>
                    Requires the{" "}
                    <span style={{ color: "var(--pw-accent)", fontWeight: 500 }}>
                      Request records from my vets
                    </span>{" "}
                    authorization. Grant it on{" "}
                    <a
                      href="/settings/authorizations"
                      style={{
                        color: "var(--pw-accent)",
                        textDecoration: "underline",
                        textUnderlineOffset: 2,
                      }}
                    >
                      Settings → Authorizations
                    </a>
                    .
                  </>
                )}
            </div>
          </div>
        </div>
        {autoRequest && authorizationGranted && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              paddingLeft: 56,
            }}
          >
            <label
              htmlFor="auto_request_lead_days"
              style={{
                font: "500 11px var(--font-inter)",
                color: "var(--pw-text-muted)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Send
            </label>
            <input
              id="auto_request_lead_days"
              type="number"
              min={0}
              max={30}
              step={1}
              value={autoRequestLeadDays}
              onChange={(e) =>
                setAutoRequestLeadDays(
                  Math.max(0, Math.min(30, Number(e.target.value) || 0)),
                )
              }
              style={{
                width: 64,
                height: 30,
                padding: "0 8px",
                borderRadius: 6,
                border: "1px solid var(--pw-border-strong)",
                background: "var(--pw-surface)",
                color: "var(--pw-text)",
                font: "400 13px var(--font-inter)",
                outline: "none",
                textAlign: "right",
              }}
            />
            <span
              style={{
                font: "400 12.5px var(--font-inter)",
                color: "var(--pw-text-secondary)",
              }}
            >
              day{autoRequestLeadDays === 1 ? "" : "s"} after the visit
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 36,
            padding: "0 16px",
            borderRadius: 6,
            background: "var(--pw-accent)",
            border: "1px solid var(--pw-accent)",
            color: "#fff",
            font: "500 13px var(--font-inter)",
            cursor: isPending ? "default" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Saving…" : "Save preferences"}
          <Icon name="check" size={13} />
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 12px",
  borderRadius: 6,
  border: "1px solid var(--pw-border-strong)",
  background: "var(--pw-surface)",
  color: "var(--pw-text)",
  font: "400 13px var(--font-inter)",
  outline: "none",
};
