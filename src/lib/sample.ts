export const SAMPLE_TRANSCRIPT = `Priya (PM): Morning everyone, Sprint 7 planning. Let's lock the portal work. Marcus, where are we on auth?
Marcus (TL): Login works, but we still need password reset and we have to add Google OAuth before launch.
Priya (PM): Password reset is critical, it's blocking the beta. Who takes it?
Marcus (TL): Aisha can own the password reset flow. Diego, you take the Google OAuth integration.
Aisha (SDE2): Sounds good, I'll implement the reset flow with email tokens.
Diego (SDE2): I'll wire up Google OAuth this sprint.
Priya (PM): We also need the billing page. The Stripe integration is half done.
Marcus (TL): Right, we should finish the Stripe checkout and add a webhook handler for failed payments.
Diego (SDE2): I can build the Stripe webhook handler after OAuth.
Priya (PM): The usage dashboard, design is ready, someone needs to build the charts.
Tom (SDE1): Happy to take the usage dashboard charts.
Priya (PM): We need test coverage too, last release had regressions.
Lena (QA): I'll write end-to-end tests for the auth and billing flows.
Marcus (TL): One more, we have to fix the slow project list query, it's timing out for big accounts. That's urgent.
Aisha (SDE2): I'll investigate and optimize the project list query.
Priya (PM): Let's also set up staging deploys so QA can test before prod. Lower priority, nice to have this sprint.
Marcus (TL): I'll set up the staging deploy pipeline if I have time.
Priya (PM): Perfect, that's the sprint. Thanks everyone.`;
