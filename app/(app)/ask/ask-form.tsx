"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Icon } from "@/components/brand/icon";

import { askAction, type AskState } from "./actions";

const initial: AskState = { status: "idle" };

export function AskForm() {
  const [state, formAction, pending] = useActionState(askAction, initial);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <form
        action={formAction}
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        <textarea
          name="question"
          rows={3}
          placeholder="Ask anything about your pets' records…"
          required
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 8,
            border: "1px solid var(--pw-border-strong)",
            background: "var(--pw-surface)",
            color: "var(--pw-text)",
            font: "400 14px var(--font-inter)",
            outline: "none",
            resize: "vertical",
            minHeight: 80,
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={pending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 36,
              padding: "0 16px",
              borderRadius: 6,
              background: "var(--pw-accent)",
              border: "1px solid var(--pw-accent)",
              color: "var(--pw-accent-fg)",
              font: "500 13px var(--font-inter)",
              cursor: pending ? "wait" : "pointer",
              opacity: pending ? 0.7 : 1,
            }}
          >
            <Icon name="sparkles" size={13} />
            {pending ? "Thinking…" : "Ask"}
          </button>
        </div>
      </form>

      {state.status === "error" && (
        <div
          className="pw-card"
          style={{
            padding: 14,
            background: "var(--pw-info-bg)",
            color: "var(--pw-info-fg)",
            font: "400 13px var(--font-inter)",
          }}
        >
          {state.message}
        </div>
      )}

      {state.status === "answered" && (
        <article
          className="pw-card"
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <header>
            <div
              style={{
                font: "500 11px var(--font-inter)",
                color: "var(--pw-text-muted)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              You asked
            </div>
            <p
              style={{
                margin: "4px 0 0",
                font: "500 14.5px var(--font-inter)",
                color: "var(--pw-text)",
              }}
            >
              {state.question}
            </p>
          </header>

          <div
            style={{
              font: "400 14px var(--font-inter)",
              color: "var(--pw-text)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {state.answer.answer}
          </div>

          {state.answer.citations.length > 0 && (
            <details
              style={{
                paddingTop: 12,
                borderTop: "1px solid var(--pw-border)",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  font: "500 11.5px var(--font-inter)",
                  color: "var(--pw-text-muted)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Sources ({state.answer.citations.length})
              </summary>
              <ul
                style={{
                  listStyle: "none",
                  margin: "10px 0 0",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {state.answer.citations.map((c) => (
                  <li
                    key={c.index}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: 10,
                      borderRadius: 6,
                      background: "var(--pw-surface-muted)",
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: 26,
                        height: 22,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "var(--pw-accent-soft)",
                        color: "var(--pw-accent-fg-on-soft)",
                        borderRadius: 4,
                        font: "600 11px var(--font-jetbrains-mono)",
                      }}
                    >
                      #{c.index}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          font: "500 12px var(--font-inter)",
                          color: "var(--pw-text-secondary)",
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        {c.pet_name && <span>{c.pet_name}</span>}
                        {c.source_path && (
                          <span className="mono" style={{ color: "var(--pw-text-muted)" }}>
                            {c.source_path}
                          </span>
                        )}
                        <span
                          style={{
                            font: "400 10.5px var(--font-inter)",
                            color: "var(--pw-text-subtle)",
                            marginLeft: "auto",
                          }}
                        >
                          {(c.similarity * 100).toFixed(0)}% match
                        </span>
                      </div>
                      <p
                        style={{
                          margin: "4px 0 6px",
                          font: "400 12.5px var(--font-inter)",
                          color: "var(--pw-text)",
                          lineHeight: 1.45,
                        }}
                      >
                        {c.snippet}
                      </p>
                      {c.pet_id && (
                        <Link
                          href={`/pets/${c.pet_id}/documents/${c.document_id}`}
                          style={{
                            font: "500 11.5px var(--font-inter)",
                            color: "var(--pw-accent)",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          View document
                          <Icon name="externalLink" size={10} />
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <footer
            style={{
              font: "400 11px var(--font-inter)",
              color: "var(--pw-text-subtle)",
              paddingTop: 8,
              borderTop: "1px solid var(--pw-border)",
            }}
          >
            Answered by {state.answer.used_model} · {state.answer.retrieved} snippets
            retrieved · Pawdex never gives medical advice — verify with your vet.
          </footer>
        </article>
      )}
    </div>
  );
}
