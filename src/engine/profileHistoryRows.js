// History consumers require an explicit athlete identity on every row.
export function mapProfileHistoryRows(rows, profileId) {
  return (rows || [])
    .filter((row) => !row.profile_id || row.profile_id === profileId)
    .map((row) => ({
      id: row.id || null,
      profile_id: profileId,
      date_ymd: row.date_ymd,
      log: row.log_json || row.log || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    }))
    .filter((row) => row.log);
}
