# CrOMS Developer Handbook (Updated with Contributor Identity & Payment Logic)

## 1. Overview
CrOMS (Contributions Operations Management System) simplifies contribution management for Harambee, welfare groups, alumni associations, churches, and all community-driven financial efforts. This handbook defines the logic and engineering guidelines for developers.

---
## 2. System Modules
- Authentication & Roles
- Group & Campaign Management
- Transaction Parsing Engine
- Contributions Engine
- Contributor Identity System ✅ NEW
- WhatsApp Summary Generator (with payment methods) ✅ NEW
- Reports & Dashboard

---
## 3. Contributor Identity Management (NEW)
CrOMS must support individuals, titled persons, families, and organized groups.

### 3.1 Required Fields
- **display_name** → How the contributor appears publicly
- **formal_name** → Extracted MPesa/bank name
- **identity_type** → Enum: individual, titled_individual, family, group, organization, anonymous
- **alternate_senders** → JSON list of MPesa sender names
- **canonical_id** → Internal unified ID

### 3.2 Matching Logic
1. On parsing a transaction:
   - Extract MPesa sender → e.g., "John Otieno".
2. CrOMS searches for matches:
   - Compare against **alternate_senders**
   - Compare against **display_name** similarity
   - Compare against **formal_name** similarity
3. Treasurer confirms the match if ambiguous.
4. First captured display_name becomes the master identity.
5. System auto-links future MPesa names.

### 3.3 Group & Family Behavior
- Families such as "The Family of Mr. & Mrs. Otieno" remain a **single contributor**.
- Groups such as "St. Mary's Alumni" may have different MPesa senders.

---
## 4. Payment Instruction Logic (NEW)
A WhatsApp update must include **how to pay** for new contributors.

### 4.1 Supported Payment Methods
- MPesa Paybill
- MPesa Till
- Phone number
- Bank transfer

### 4.2 Example Output
```
You can still contribute via:
MPESA PAYBILL: 123456 (Acc: CrOMS-Project)
Bank: KCB 123456789 (CrOMS Community Account)
```

---
## 5. Target & Deficit Logic (NEW)
CrOMS campaigns may optionally include a **target amount**.

### Fields
- target_amount
- total_raised
- deficit = target_amount - total_raised

### WhatsApp Message Example
```
TARGET: 150,000 KES
RAISED: 82,500 KES
DEFICIT: 67,500 KES
```

---
## 6. Data Model Update

### contributors table
```
id
campaign_id
formal_name
display_name
identity_type
alternate_senders (JSONB)
canonical_id
```

### campaigns table
```
id
group_id
name
target_amount
status
```

---
## 7. API Updates
```
POST /contributors/{id}/add-sender
POST /campaigns/{id}/update-target
```

---
## 8. Parsing Flow
Raw message → Regex → Fallback AI → Contributor suggestion → Confirmation → Save → Update totals

---
## End of Developer Handbook