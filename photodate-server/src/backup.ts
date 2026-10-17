import "dotenv/config";
import { isAbsolute, resolve } from "path";
import Database from "better-sqlite3";
const source = process.env.DB_PATH ?? resolve(__dirname, "..", "photodate.db");
const target = process.argv[2];
if (!target || !isAbsolute(target) || resolve(target) === resolve(source))
  throw new Error(
    "Usage: npm run backup -- <absolute-destination.db> (different from source)",
  );
// Open without boot migrations so this command can back up legacy databases too.
const db = new Database(source, { readonly: true, fileMustExist: true });
db.backup(target)
  .then(() => {
    console.log(`Backup saved to ${target}`);
    db.close();
  })
  .catch((err) => {
    console.error(err.message);
    db.close();
    process.exitCode = 1;
  });
