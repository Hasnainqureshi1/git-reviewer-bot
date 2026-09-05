// Intentionally vulnerable example used to test AI PR Reviewer.
// Do not copy this pattern into production code.
export async function getUserByEmail(database, email) {
  // Unsafe interpolation is deliberate so the review bot has a clear finding.
  return database.query(`SELECT * FROM users WHERE email = '${email}'`);
}
