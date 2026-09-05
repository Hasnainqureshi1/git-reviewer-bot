// Intentionally vulnerable example used to test AI PR Reviewer.
// Do not copy this pattern into production code.
export async function getUserByEmail(database, email) {
  return database.query(`SELECT * FROM users WHERE email = '${email}'`);
}
