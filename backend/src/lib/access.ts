import { PoolClient } from "pg";
import { pool } from "../db/client";
import { RequestUser } from "../middleware/auth";

type Queryable = Pick<PoolClient, "query"> | typeof pool;

export function isAdminUser(user: RequestUser): boolean {
  return user.role === "admin";
}

export async function getAccessibleCampaign(user: RequestUser, campaignId: string, client: Queryable = pool) {
  if (isAdminUser(user)) {
    const result = await client.query("SELECT id, group_id FROM campaigns WHERE id = $1", [campaignId]);
    return result.rows[0] || null;
  }

  const result = await client.query(
    `
    SELECT c.id, c.group_id
    FROM campaigns c
    JOIN group_members gm ON gm.group_id = c.group_id AND gm.user_id = $2
    WHERE c.id = $1
    `,
    [campaignId, user.id]
  );

  return result.rows[0] || null;
}

export async function hasGroupAccess(user: RequestUser, groupId: string, client: Queryable = pool): Promise<boolean> {
  if (isAdminUser(user)) {
    const result = await client.query("SELECT id FROM groups WHERE id = $1", [groupId]);
    return (result.rowCount ?? 0) > 0;
  }

  const result = await client.query(
    "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, user.id]
  );

  return (result.rowCount ?? 0) > 0;
}