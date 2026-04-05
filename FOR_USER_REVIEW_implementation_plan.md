# Implementation Plan - Manual Fraud Demonstration Expansion (Updated)

The goal is to enable manual demonstration of SCF fraud types with specific form fields and a new dispute mechanism that feeds back into the risk engine.

## User Review Required

> [!IMPORTANT]
> - **Risk Engine Feedback**: Raising a dispute will now automatically update the invoice status to `DISPUTED` and trigger a re-evaluation, adding **50 points** to the risk score via a new `invoice_disputed` rule.
> - **Lender Visibility**: Disputed invoices will be highlighted with a warning banner in the Lender's Invoice Queue.
> - **Buyer Restrictions**: The new "Buyer Invoices" tab will strictly show only invoices where the buyer's company ID matches the logged-in user.

## Proposed Changes

### Database Migration

#### [NEW] [migration_fraud_demo.js](file:///d:/COLLEGE/hacks/sherlock-scf-fraud-detection-system/db/migration_fraud_demo.js)
- Add `parent_po_id` (INTEGER) to `purchase_orders`.
- Add `receipt_date` (TIMESTAMP) to `goods_receipts`.
- Create `disputes` table as specified.

### Backend Infrastructure

#### [MODIFY] [erpController.js](file:///d:/COLLEGE/hacks/sherlock-scf-fraud-detection-system/controllers/erpController.js)
- **Actions Update**: Allow custom dates for POs, GRNs, and Deliveries.
- **PO Update**: Store `parent_po_id`.
- **[NEW] createDispute**:
    - Insert into `disputes`.
    - Set `invoices.status = 'DISPUTED'`.
    - Trigger `riskEngineService.evaluateRisk`.
- **[NEW] getBuyerInvoices**: Filtered by `req.user.company_id`.

#### [MODIFY] [invoiceController.js](file:///d:/COLLEGE/hacks/sherlock-scf-fraud-detection-system/controllers/invoiceController.js)
- `submitInvoice`: Accept `invoice_date` from payload.

#### [MODIFY] [identityController.js](file:///d:/COLLEGE/hacks/sherlock-scf-fraud-detection-system/controllers/identityController.js)
- `createCompany`: Accept `annual_revenue` from payload.

#### [MODIFY] [riskEngineService.js](file:///d:/COLLEGE/hacks/sherlock-scf-fraud-detection-system/services/riskEngineService.js)
- Add `invoice_disputed` rule (50 pts).
- Implement check for dispute record within `evaluateRisk`.

### API Routes

#### [MODIFY] [erpRoutes.js](file:///d:/COLLEGE/hacks/sherlock-scf-fraud-detection-system/routes/erpRoutes.js)
- Add `POST /disputes` (Buyer only).
- Add `GET /buyer-invoices` (Buyer only).

### Frontend UI

#### [MODIFY] [erp-portal.tsx](file:///d:/COLLEGE/hacks/sherlock-scf-fraud-detection-system/frontend/src/pages/erp-portal.tsx)
- PO Form: Add `po_date` picker and `parent_po_id` dropdown fetching available POs.
- GRN Form: Add `receipt_date` picker.
- Delivery Form: Add `delivery_date` picker.
- Invoice Form: Add `invoice_date` picker.
- **Buyer Dashboard**:
    - Add "Invoices" tab.
    - Implement "Raise Dispute" button and modal with exact reasons: `GOODS_RETURNED`, `QUALITY_ISSUE`, `QUANTITY_MISMATCH`, `FRAUDULENT`.

#### [MODIFY] [invoice-queue.tsx](file:///d:/COLLEGE/hacks/sherlock-scf-fraud-detection-system/frontend/src/components/dashboard/invoice-queue.tsx)
- Add styling for `DISPUTED` status.
- Add "ACTIVE DISPUTE" warning banner in the risk analysis side panel when an invoice is disputed.

#### [MODIFY] [data-ingestion.tsx](file:///d:/COLLEGE/hacks/sherlock-scf-fraud-detection-system/frontend/src/pages/data-ingestion.tsx)
- Add `annual_revenue` field to company registration.

---

## Verification Plan

### Automated Tests
- `scripts/test_fraud_demo.js`: Verify PO/Invoice date storage, and dispute → score recalculation flow.

### Manual Verification
1.  **Velocity Fraud**: Backdate 5 invoices as a supplier to "today" and verify score spike.
2.  **Dilution Fraud**: As a Buyer, raise a dispute on an approved invoice. Verify status changes to DISPUTED and score increases. Verify Lender sees the warning banner.
3.  **Feasibility Fraud**: Create a company with 10k revenue, submit a 100k invoice. Verify 30pt penalty.
4.  **Cross-Tier Cascade**: Create a PO referencing another as Parent PO.
