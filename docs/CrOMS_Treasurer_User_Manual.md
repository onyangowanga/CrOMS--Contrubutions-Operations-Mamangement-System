# CrOMS Treasurer User Manual

## Brief Overview

CrOMS helps a treasurer manage contributions for the groups they are assigned to.

As a treasurer, you can:

- sign in and change your password
- see only the groups and campaigns you belong to
- create campaigns for your assigned groups
- add payment methods for those campaigns
- log M-Pesa payments
- log cash payments
- review and approve unclear contributor matches
- generate and copy WhatsApp contribution summaries
- export campaign reports in CSV, Excel, and PDF
- delete incorrect transactions after confirming your current password

As a treasurer, you cannot:

- create users
- create or delete groups globally
- access campaigns from other groups
- use the admin-only workspace unless you also have admin rights

## Who This Manual Is For

This manual is for users with the `treasurer` role in CrOMS.

It explains the normal day-to-day work of recording contributions, checking summaries, and exporting reports.

## Main Screens You Will Use

### Dashboard

The dashboard shows:

- your visible campaigns
- contribution totals
- contributor totals
- chart summaries for the selected campaign

Use the dashboard to get a quick view of current activity before recording or reviewing payments.

### Log Payment

This is the main working screen for a treasurer.

It includes:

- M-Pesa payment logging
- cash payment logging
- WhatsApp summary preview and copy
- pending review items for unclear contributor matches

### Campaigns

Use the campaigns page to:

- create a new campaign
- set a target amount
- set default WhatsApp header text
- set default WhatsApp additional text
- add payment channels such as paybill, till, phone, or bank
- change a campaign between `active` and `closed`

### Reports

Use the reports page to:

- review contributor totals
- review transaction totals by day
- export CSV, Excel, and PDF reports
- delete incorrect transactions after password confirmation

## Sign In

1. Open the CrOMS login page.
2. Enter your email address.
3. Enter your password.
4. Select `Login`.

If you forgot your password:

1. Select `Forget password`.
2. Enter your email address to generate a reset token.
3. Enter the token and a new password.
4. Return to login and sign in again.

## How Group Access Works

CrOMS is group-isolated.

This means:

- you only see groups you belong to
- you only see campaigns under those groups
- you only see contributors, transactions, summaries, and reports for those campaigns

If you cannot see a campaign or report, it usually means your account is not assigned to that group.

## Common Treasurer Tasks

## 1. Create a Campaign

1. Open `Campaigns`.
2. Select the group you are allowed to manage.
3. Enter the campaign name.
4. Enter a target amount if needed.
5. Enter an optional WhatsApp header.
6. Enter an optional extra WhatsApp line.
7. Select `Create Campaign`.

Use clear campaign names such as:

- Building Fund April 2026
- Welfare Support Drive
- Funeral Contribution Appeal

## 2. Add a Payment Method

1. Stay on the `Campaigns` page.
2. Open the `Payment Channels` section.
3. Select the campaign.
4. Select the method type.
5. Enter the payment value.
6. Enter a clear label.
7. Select `Save Method`.

Examples:

- Paybill with an account name
- Till number
- Treasurer phone number
- Bank account details

These payment methods appear in the WhatsApp summary.

## 3. Log an M-Pesa Payment

1. Open `Log Payment`.
2. Stay on the `M-Pesa Payment` tab.
3. Select the campaign.
4. Paste the full M-Pesa message exactly as received.
5. Optionally enter a display name override if the sender name needs correction.
6. Optionally adjust the identity type.
7. Select `Post M-Pesa Payment`.
8. Review the confirmation prompt.
9. Confirm to post the transaction.

Possible results:

- `Contribution stored` means the payment was saved immediately.
- `Contribution queued for review` means CrOMS could not confidently match the contributor.
- `Duplicate transaction ignored` means the transaction code already exists in the system.

## 4. Log a Cash Payment

1. Open `Log Payment`.
2. Switch to the `Cash Payment` tab.
3. Select the campaign.
4. Select an existing contributor, or type a display name for a new contributor.
5. Select the identity type.
6. Enter the amount.
7. Optionally enter a reference code.
8. Optionally enter the received date and time.
9. Optionally enter a note.
10. Select `Post Cash Payment`.
11. Review the confirmation prompt.
12. Confirm to post the cash entry.

Use cash logging for:

- church basket collections
- manual hand-delivered contributions
- event desk receipts
- treasurer-confirmed offline contributions

## 5. Review a Queued Contribution

Sometimes CrOMS cannot confidently match a sender to the correct contributor.

When this happens:

1. Open `Log Payment`.
2. Select the pending review item.
3. Review the sender name, amount, transaction code, and reason.
4. Choose an existing contributor if there is a match.
5. Or enter the correct display name.
6. Set the correct identity type.
7. Select `Approve and Save` to post it.
8. Or select `Reject` if it should not be posted.

Approve when:

- you know who sent the contribution
- the contributor name only needs correction
- the suggested match is clearly the right person or group

Reject when:

- the message was pasted incorrectly
- the transaction does not belong to the campaign
- the contribution cannot be trusted yet

## 6. Generate and Copy the WhatsApp Summary

1. Open `Log Payment`.
2. Go to the `WhatsApp Summary` section.
3. Select the campaign if needed.
4. Adjust the top message if needed.
5. Adjust the additional line if needed.
6. Choose whether to include target and deficit.
7. Select `Refresh`.
8. Review the summary text.
9. Select `Copy Summary`.
10. Paste it into WhatsApp.

The summary can include:

- campaign header text
- extra information line
- payment methods
- contributor list
- total raised
- target
- deficit

## 7. Export Reports

1. Open `Reports`.
2. Confirm you are looking at the correct campaign.
3. Choose one of the export buttons:
4. `CSV` for contributor ledger export.
5. `Excel` for statement export.
6. `PDF` for printable statement export.

Use:

- CSV for simple spreadsheet review
- Excel for finance sharing and editing
- PDF for cleaner read-only circulation

## 8. Delete an Incorrect Transaction

Use deletion carefully.

Deleting a transaction updates both:

- the contributor total
- the campaign total

To delete:

1. Open `Reports`.
2. Find the transaction row.
3. Select `Delete`.
4. Enter your current password.
5. Confirm the deletion.

Only delete a transaction when you are sure it was posted in error.

## Treasurer Best Practices

- paste M-Pesa messages exactly as received
- review the campaign before posting any transaction
- use clear contributor names for cash entries
- keep payment method details updated
- refresh and review the WhatsApp summary before copying it
- export reports after major collection periods
- do not delete transactions unless the entry is clearly wrong
- protect your password and change it if you suspect exposure

## Troubleshooting

### I cannot see a campaign

Possible causes:

- you are not assigned to the group that owns it
- the campaign belongs to another group
- the campaign was not created yet

Action:

- contact an admin to confirm your group assignment

### My M-Pesa message was queued instead of saved

This means CrOMS could not confidently match the contributor.

Action:

- open the pending review item
- select the correct contributor or type the correct name
- approve and save it

### I got a duplicate transaction warning

This means the transaction code already exists.

Action:

- do not post it again until you confirm whether it was already recorded

### I cannot delete a transaction

Possible causes:

- your current password was entered incorrectly
- you do not have treasurer or admin rights
- the transaction does not belong to a campaign you can access

Action:

- re-enter your current password carefully
- confirm you are working inside your assigned group campaigns

## Security Notes

- never share your login password
- log out when using a shared device
- confirm contributor names before approving queued entries
- protect exported reports because they may contain contribution data

## Quick Treasurer Checklist

At the start of a session:

- sign in
- confirm the right campaign is selected
- confirm payment channels are correct

During collections:

- post M-Pesa payments
- post cash payments
- clear pending review items

After collections:

- refresh the WhatsApp summary
- copy and share the update
- export reports if needed
- correct any wrong transactions carefully

## Summary

For a treasurer, CrOMS is centered on three main jobs:

- record payments accurately
- keep campaign summaries current
- produce clean reports for accountability

If you stay within those three workflows, most daily operations in CrOMS are straightforward and fast.