# Demo readiness and the three-customer pilot

Scope: how the App Owner prepares and checks the first three customer demos,
and what to do when a check fails. Audience: the App Owner, and the engineer
supporting the demos.

## 1. What a demo-ready customer has

Each item is checked live by `adminGetDemoReadiness` (App Owner tab **Demo
Readiness**). Website, card and QR checks use the same anonymous resolver that
real visitors hit.

| Check | Passes when | If it fails (existing controls only) |
|---|---|---|
| Account | An active company-admin account exists for the company. | The customer registers. The App Owner cannot create logins. |
| Company | The company is active and not platform-suspended. | Reinstate the customer (customer suspension control, audited). |
| Branding | The company has a name and an uploaded logo. | Customer: Company Profile → Identity & Brand → Upload logo. |
| Website | About text exists, plus at least one service or product. | Customer: Company Profile → Overview / Services / Products → Save. |
| Employee | At least one active employee with a seat. | Customer: Employees & Cards → Add Employee (plan seat limit applies). |
| Employee Card | At least one employee card resolves publicly. | Customer: Employees & Cards → Publish. |
| Published | The company website's publishing state is PUBLISHED. | Customer: Company Profile → Company Website → Publish. |
| Public URL | `/company/{slug}` resolves `OK` for an anonymous visitor. | Fix the failing check above. Platform suspensions are lifted only through the publishing-suspension control. |
| QR | The website and at least one card URL are live, so the QR codes work. | Follows from the checks above. |

**Demo ready** means all nine checks pass. The tab also shows each employee's
card state and public outcome, the live website URL, and its QR code.

## 2. Pilot preparation (real customers)

1. In **First Customer Pilot**, mark each pilot company as a pilot. This is an
   audited classification. **Demo Readiness** lists pilots by default.
2. The customer completes the journey themselves:
   - register (marketing page → **Create Company Profile**);
   - fill in Company Profile: logo, about, services, products;
   - **Publish** the website;
   - add an employee;
   - **Publish** the employee card.
3. Open **Demo Readiness** → **Re-check** until the customer shows **DEMO
   READY**.
4. Before the demo, open the website URL and the card URL (or scan the QR) in a
   private browser window.

## 3. Recovery and demo safety (Phase 9)

- The readiness view shows the customer, company, employees, publication
  status, readiness and errors. It **never changes data**.
- Fixes go through controls that already existed and are audited:
  - customer suspension and reinstatement;
  - publishing suspension;
  - plan, trial and complimentary grants (for example, more seats);
  - the customer's own publishing.
- There is no "edit any customer's content" capability, by design.
- Typical failures:
  - **Employee Card fails after a downgrade.** Extra seats are locked
    (content retained). Raise the plan or reduce employees.
  - **Public URL is `UNAVAILABLE`.** The tenant or the website is suspended.
    Reinstate it through the audited controls.
  - **Public URL is `NOT_PUBLISHED`.** The customer unpublished the website.
    Only the customer can republish.

## 4. Rehearsal (Phase 11)

`tests/e2e/pilot-customers.json` holds three rehearsal customers: Northwind
Advisory, Bluefin Logistics and Kestrel Dental Clinics. `npm run test:browser`:

- registers each one through the UI in its own browser;
- builds each website and one employee card;
- verifies isolation and the anonymous experience;
- confirms the App Owner sees **3 of 3 demo ready**.

This data exists only in the emulator during the run. It is never loaded by
the application or written to a real project.
