import type { Item, Theme } from "./types";

// Invented data for the "Load sample" button. No real customers.
export const SAMPLE_ITEMS: Item[] = [
  {
    "id": 1,
    "customer": "Acme Logistics",
    "tier": "Enterprise",
    "arr": 84,
    "text": "Approvals stall when the approver is on leave. We need delegation or automatic escalation."
  },
  {
    "id": 2,
    "customer": "Brightwave",
    "tier": "Mid-market",
    "arr": 24,
    "text": "We cannot bulk-upload 300 vendor contracts. Importing them one by one is painful."
  },
  {
    "id": 3,
    "customer": "Northfield Bank",
    "tier": "Enterprise",
    "arr": 120,
    "text": "Security review needs SAML SSO and audit log export before we expand to the legal team."
  },
  {
    "id": 4,
    "customer": "Kiln & Co",
    "tier": "SMB",
    "arr": 6,
    "text": "Search only finds contract titles. It never finds a clause."
  },
  {
    "id": 5,
    "customer": "Parcelo",
    "tier": "Mid-market",
    "arr": 31,
    "text": "I want a Slack message when a contract is waiting for my signature."
  },
  {
    "id": 6,
    "customer": "Meridian Health",
    "tier": "Enterprise",
    "arr": 96,
    "text": "Audit log export to our SIEM is a must for compliance."
  },
  {
    "id": 7,
    "customer": "Tandem Foods",
    "tier": "Mid-market",
    "arr": 18,
    "text": "An approver on holiday blocked a deal for six days."
  },
  {
    "id": 8,
    "customer": "Zephyr Studios",
    "tier": "SMB",
    "arr": 5,
    "text": "The pricing page does not say which plan includes e-signature."
  },
  {
    "id": 9,
    "customer": "Orchard Retail",
    "tier": "Mid-market",
    "arr": 27,
    "text": "We are moving off spreadsheets and need CSV import with field mapping."
  },
  {
    "id": 10,
    "customer": "Halcyon Insurance",
    "tier": "Enterprise",
    "arr": 150,
    "text": "InfoSec requires SAML SSO by Q1 or we cannot renew."
  },
  {
    "id": 11,
    "customer": "Fenwick Legal",
    "tier": "SMB",
    "arr": 9,
    "text": "Would love to search by clause type, for example indemnity."
  },
  {
    "id": 12,
    "customer": "Lumen Telecom",
    "tier": "Enterprise",
    "arr": 72,
    "text": "Renewal date reminders arrive too late for us to renegotiate."
  }
];

export const SAMPLE_THEMES: Theme[] = [
  {
    "id": "t1",
    "title": "Enterprise security gates: SAML SSO and audit export",
    "itemIds": [
      3,
      6,
      10
    ],
    "summary": "Three enterprise accounts need SAML SSO and audit log export before they expand or renew.",
    "effort": 4,
    "effortWhy": "SAML needs testing across identity providers. The audit export is the smaller piece.",
    "confidence": 0.9,
    "blocksRevenue": true,
    "severity": "blocker",
    "prd": "# Enterprise security gates\n\n## Problem\nThree enterprise accounts say SAML SSO and audit log export decide whether they renew or expand. Without them, InfoSec blocks rollout beyond the current team.\n\n## Who is affected\nIT admins and InfoSec reviewers at accounts above $75k ARR. End users feel it as one more password and no record of who approved what.\n\n## Evidence\n- F-03 Northfield Bank ($120k): SSO and audit export needed before expanding to legal.\n- F-06 Meridian Health ($96k): audit log export to their SIEM for compliance.\n- F-10 Halcyon Insurance ($150k): SAML SSO required by Q1 or they cannot renew.\n\n## Goals\n- Admins can enforce SAML SSO for their workspace.\n- Admins can export a complete audit log on demand and on a schedule.\n\n## Non-goals\n- SCIM provisioning, planned for the next release.\n- A custom role builder.\n\n## Requirements\n- P0: SAML 2.0 with Okta and Azure AD, enforced login, and a break-glass admin account.\n- P0: Audit log covering sign-in, approval, edit and export events, exportable as CSV and JSON.\n- P1: Scheduled export to a storage bucket the customer owns.\n\n## Success metrics\n- All three accounts live on SSO before the Halcyon renewal date.\n- No high-severity findings in customer security reviews.\n- Renewal rate among the three accounts that asked for this.\n\n## Risks and open questions\n- Identity provider quirks differ by customer. Pilot with Halcyon first.\n- Audit log retention period and storage cost need a decision."
  },
  {
    "id": "t2",
    "title": "Approval delegation and escalation",
    "itemIds": [
      1,
      7
    ],
    "summary": "Deals stall when an approver is away, so approvals need a backup person or automatic escalation.",
    "effort": 2,
    "effortWhy": "Delegation rules on an existing approval flow.",
    "confidence": 0.85,
    "blocksRevenue": false,
    "severity": "high"
  },
  {
    "id": "t3",
    "title": "Renewal and signature reminders",
    "itemIds": [
      5,
      12
    ],
    "summary": "People find out too late that a signature or renewal date is coming.",
    "effort": 2,
    "effortWhy": "Notifications and a configurable lead time.",
    "confidence": 0.6,
    "blocksRevenue": false,
    "severity": "medium"
  },
  {
    "id": "t4",
    "title": "Bulk import with field mapping",
    "itemIds": [
      2,
      9
    ],
    "summary": "New customers moving from spreadsheets cannot load their existing contracts at once.",
    "effort": 3,
    "effortWhy": "CSV parsing, mapping screen and error handling.",
    "confidence": 0.8,
    "blocksRevenue": false,
    "severity": "medium"
  },
  {
    "id": "t5",
    "title": "Pricing page clarity",
    "itemIds": [
      8
    ],
    "summary": "A prospect cannot tell which plan includes e-signature.",
    "effort": 1,
    "effortWhy": "Copy change on one page.",
    "confidence": 0.7,
    "blocksRevenue": false,
    "severity": "low"
  },
  {
    "id": "t6",
    "title": "Clause-level search",
    "itemIds": [
      4,
      11
    ],
    "summary": "Users want to find contracts by what a clause says, not by title.",
    "effort": 5,
    "effortWhy": "Needs clause extraction and a new search index.",
    "confidence": 0.5,
    "blocksRevenue": false,
    "severity": "low"
  }
];
