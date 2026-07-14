# GDPR Posture and Readiness

Not legal advice. Founder decision recorded July 13, 2026: stay US-only; keep GDPR
out of scope by non-applicability rather than building EEA machinery pre-launch.
This mirrors docs/compliance-audit.md §7.

## Why we are compliant today (by non-applicability)

GDPR applies (Art. 3) only if we (a) offer goods/services to data subjects in the
EEA, or (b) monitor their behavior in the EEA. Pawdex does neither:

- US-only offering is stated on the privacy page ("offered in the United States
  and is not directed to, or marketed in, the EEA, the UK, or other regions") and
  now on the sign-in page. Terms set US/California governing law.
- No EEA-targeted marketing. No EEA-language pages, no EEA ad targeting.
- No behavioral monitoring of EEA users. The only analytics are Vercel Web
  Analytics and Speed Insights, which are first-party and cookieless (no
  third-party trackers, pixels, session-replay, or ad networks anywhere in the
  codebase, verified). This also keeps us clear of the ePrivacy cookie-consent
  requirement and of US wiretap/pixel (CIPA) theories.

That combination is the recognized way a US product stays outside GDPR's
territorial scope. It is a posture, not a technical geo-block: an EEA resident
can still sign up. The founder chose not to hard-fence by IP (would risk blocking
US travelers/VPN users). If abuse or real EEA signups appear, revisit.

## Keep the posture intact (do not silently break it)

The moment any of these change, GDPR (and ePrivacy) can attach and this document
is stale:

- Do NOT add EEA-targeted marketing, EEA-language content, or EU-region ad
  campaigns.
- Do NOT add any third-party tracker, pixel, session-replay, chat widget, or ad
  network. First-party cookieless analytics only. Adding one flips the
  cookie-consent and CIPA analysis (see compliance-audit.md §2).
- Do NOT begin onboarding EEA/UK users deliberately (e.g. an EEA breeder channel)
  without first working the readiness checklist below.

## Readiness checklist (do BEFORE opening EEA/UK markets)

If/when the decision flips to serving the EEA/UK, this is the minimum:

1. Lawful basis mapping + a Record of Processing Activities (Art. 30) covering
   account data, uploaded pet medical documents, and derived AI extractions.
2. Data Subject Access Request flows: access, portability, rectification, and
   erasure. Much of this already exists: export-before-delete and the 30-day
   soft-delete + CCPA hard-delete feature (migrations 0033/0034) map closely onto
   Art. 15/17/20. Reuse it; add access/rectification surfacing.
3. Art. 27 EU representative appointment (a named entity in an EEA member state).
4. International-transfer mechanism: Standard Contractual Clauses (or an adequacy
   path) with every subprocessor that stores/processes data outside the EEA:
   Supabase, Vercel, OpenRouter, Resend. Confirm each offers SCCs/DPA. This ties
   to compliance-audit.md's open item "confirm signed DPAs on file."
5. ePrivacy cookie-consent banner if any non-essential cookie/tracker is added
   for EEA visitors (none today).
6. Breach-notification runbook (72-hour supervisory-authority notification;
   Art. 33/34) and a DPIA for the AI extraction of health-adjacent documents.
7. Updated privacy policy with the GDPR-specific disclosures (legal bases,
   retention periods, DSAR channel, EU rep contact, right to lodge a complaint).

## What was done in this pass (July 13, 2026)

- Verified the US-only statement is consistent across privacy, terms, and (added)
  the sign-in page; added Terms + Privacy links and a US-only notice at sign-in,
  which also strengthens contract assent.
- Confirmed zero third-party trackers/pixels; analytics are first-party cookieless.
- Recorded this posture and the expansion checklist here. No EEA machinery built,
  per the founder decision.
