# CrOMS Full System Blueprint

## 1. Overview
CrOMS (Contributions Operations Management System) is a SaaS platform designed to automate, organize, and communicate financial contributions for community-based fundraising activities such as Harambees, medical bill drives, funerals, welfare groups, school fee contributions, church contributions, alumni associations, chamas, and organizational support activities.

This is the **complete blueprint**, combining all modules, design logic, architecture, workflows, identity management logic, payment messaging logic, and target/deficit logic.

---
## 2. System Vision
CrOMS aims to:
- Reduce treasurer workload
- Ensure zero duplication of contributions
- Automate parsing of MPesa and bank messages
- Provide transparent contribution summaries
- Provide real-time progress toward fundraising goals
- Support identity-based grouping (titles, families, organizations)
- Offer AI-assisted parsing and name matching (future)

---
## 3. System Architecture (Full)

### 3.1 Architecture Layers
- **Frontend:** React (Web), Flutter (Mobile)
- **Backend:** Laravel (recommended) or NestJS (Node)
- **Services:** Parsing engine, Contributor Identity Engine, Summary Generator
- **Database:** PostgreSQL (relational), JSONB for flexible fields
- **Object Storage:** Reports (PDF, CSV, Excel)
- **Infrastructure:** Docker, Nginx, Cloud hosting

### 3.2 High-Level Diagram
```
Frontend (React / Flutter)
        |
        ▼
Backend API Gateway (Laravel / Node)
        |
 ┌──────┼─────────────────────────────┬──────────────┐
 │      │                             │              │
Auth  Parsing Engine         Contribution Engine   Summary Generator
        |                             |              |
        └───────────────┬─────────────┴──────────────┘
                        ▼
             PostgreSQL + File Storage
```

---
## 4. Modules (Complete Breakdown)

### 4.1 Authentication & User Management
- JWT authentication
- Forgot password
- Roles: Admin, Treasurer, Viewer
- Multi-group membership

### 4.2 Group Management
- Create/edit/delete groups
- Group branding and description
- Add/remove members
- Assign roles

### 4.3 Campaign Management
- Create fundraising campaigns
- Status: active, closed
- Target amount (optional)
- Campaign progress

### 4.4 Transaction Parsing Engine
- Accept raw text from MPesa or banks
- Extract amount, sender name, timestamp, transaction code
- Detect duplicates
- Suggest contributor identity match
- Regex-first approach with AI fallback (future)

### 4.5 Contributor Identity System (FULL logic)
CrOMS supports individuals, titled persons, families, and organizations.

#### Required Fields
- display_name
- formal_name
- identity_type (individual, titled_individual, family, group, organization, anonymous)
- alternate_senders (JSONB list)
- canonical_id (UUID anchor)

#### Matching Rules
- First capture becomes the identity master
- Future matches check:
  - alternate_senders
  - formal_name
  - display_name similarity
- Treasurer confirms uncertain matches
- Groups can have multiple senders

### 4.6 Contribution Engine
- Store verified contributions
- Update totals per contributor
- Update campaign totals
- Maintain transaction history

### 4.7 Payment Method Logic (FULL)
CrOMS includes payment instructions in summaries.

#### Supported Payment Methods
- MPESA Paybill
- MPESA Till
- Phone Number
- Bank Account

#### Storage Fields
```
payment_methods:
- id
- campaign_id
- method_type
- value
- label
```

### 4.8 WhatsApp Summary Generator (FULL)
Includes:
- Title
- Contribution list
- Total amount
- Target amount (optional)
- Deficit (auto-calculated)
- Payment instructions
- Closing message

### 4.9 Reporting Module
- Contributor list
- Total raised
- Export PDF/CSV/Excel
- Graphs and trends

---
## 5. Data Model (Full Schema)

### contributors table
```
id UUID
campaign_id UUID
formal_name VARCHAR
display_name VARCHAR
identity_type ENUM
alternate_senders JSONB
canonical_id UUID
```

### transactions table
```
id UUID
campaign_id UUID
contributor_id UUID
amount DECIMAL
transaction_code VARCHAR
message_raw TEXT
source ENUM(mpesa, bank, manual)
```

### campaigns table
```
id UUID
group_id UUID
name VARCHAR
target_amount DECIMAL
status ENUM(active, closed)
```

### payment_methods table
```
id UUID
campaign_id UUID
method_type ENUM
value VARCHAR
label VARCHAR
```

---
## 6. API Design (Full)
```
/auth/*
/groups/*
/groups/{id}/users
/campaigns/*
/parse
/transactions/*
/contributors/*
/reports/*
/payment-methods/*
```

---
## 7. Workflows (End-to-End)

### 7.1 Treasurer Workflow
1. Create group
2. Create campaign
3. Add payment methods
4. Paste MPesa messages
5. System parses fields
6. System suggests contributor match
7. Treasurer confirms
8. System updates totals
9. Treasurer generates and posts WhatsApp summary

### 7.2 Parsing Workflow
```
Raw Text → Regex Parsing → Duplicate Check → Identity Match → Confirmation → Save → Totals Update
```

---
## 8. WhatsApp Templates (Full)
```
*{CAMPAIGN NAME} — CONTRIBUTION UPDATE*

You can still contribute via:
{PAYMENT_METHODS}

--------------------------------
{CONTRIBUTOR LIST}
--------------------------------
TOTAL: {TOTAL} KES
TARGET: {TARGET} KES
DEFICIT: {DEFICIT} KES

Thank you for your support.
```

---
## 9. Future Roadmap
- MPESA API real-time integration
- AI NLP parsing
- Fraud detection
- Multi-currency support
- Organizational dashboards

---
## END OF FILE