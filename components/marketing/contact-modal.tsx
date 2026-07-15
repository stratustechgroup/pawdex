"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ContactForm } from "@/components/marketing/contact-form";

type ContactModalTriggerProps = {
  /** Custom trigger content. Falls back to `label`. */
  children?: React.ReactNode;
  /** Trigger text when no children are given. */
  label?: string;
  /** Extra classes appended to the trigger. */
  className?: string;
  /**
   * Built-in trigger looks. "link" reads like a nav link (default), "button"
   * renders the marketing pill button. Ignored when `asChild` is set.
   */
  variant?: "link" | "button";
  /**
   * Escape hatch: render your own single element as the trigger (e.g. an
   * <a className="mk-nav-link"> or <button className="mk-btn">). When true,
   * `children` must be exactly one element and `variant` is ignored.
   */
  asChild?: boolean;
};

// Self-contained contact dialog. Drop <ContactModalTrigger /> anywhere (header,
// footer) and it opens a mobile-safe modal wrapping the shared ContactForm.
// Mobile safety: the content caps at 85dvh with an inner scroll area, so a tall
// form never pushes the submit button off-screen; the close button stays pinned
// outside the scroll area and Escape / overlay-click also dismiss it (Radix).
export function ContactModalTrigger({
  children,
  label = "Contact",
  className,
  variant = "link",
  asChild = false,
}: ContactModalTriggerProps) {
  return (
    <Dialog>
      <style href="pw-contact-modal" precedence="medium">
        {MODAL_CSS}
      </style>

      {asChild ? (
        <DialogTrigger asChild>{children}</DialogTrigger>
      ) : variant === "button" ? (
        <DialogTrigger className={cn("mk-btn", className)}>
          {children ?? label}
        </DialogTrigger>
      ) : (
        <DialogTrigger className={cn("pw-contact-trigger-link", className)}>
          {children ?? label}
        </DialogTrigger>
      )}

      <DialogContent className="pw-contact-dialog flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {/* pr-12 keeps the title clear of the absolute close button. shrink-0 so
            the header never scrolls; the body below owns the overflow. */}
        <DialogHeader className="shrink-0 p-5 pr-12 pb-3">
          <DialogTitle>Contact us</DialogTitle>
          <DialogDescription>
            Send us a message and a real person will reply within a few business
            days.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <ContactForm compact />
        </div>
      </DialogContent>
    </Dialog>
  );
}

const MODAL_CSS = `
/* The dialog content is portalled outside the .mk shell, so re-declare the
   marketing font vars here for anything inside it that reaches for them. */
.pw-contact-dialog {
  --mk-body: var(--font-inter), system-ui, sans-serif;
  --mk-mono: var(--font-jetbrains), "SF Mono", monospace;
}
/* Nav-link look, but self-contained so it carries no default button chrome and
   does not depend on stylesheet order against .mk-btn. */
.pw-contact-trigger-link {
  -webkit-appearance: none;
  appearance: none;
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  cursor: pointer;
  font: 500 13.5px var(--mk-body, var(--font-inter), system-ui, sans-serif);
  color: var(--pw-text-secondary);
  text-decoration: none;
  transition: color 0.15s ease;
}
.pw-contact-trigger-link:hover {
  color: var(--pw-text);
}
`;
