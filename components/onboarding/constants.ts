// Durable "don't force onboarding again" marker. Set by completeOnboarding()
// and read by the auth callback before it routes a brand-new session to
// /onboarding, so a user who skips the flow isn't looped back in on their next
// login within the hour. A cookie is the honest no-migration option, there is
// no profiles/household column for this yet.
//
// Lives outside actions.ts because a "use server" file may only export async
// functions; both the action and the route import this constant from here.
export const ONBOARDED_COOKIE = "pawdex_onboarded";
