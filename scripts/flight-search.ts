import { runFlightSearch } from "../lib/search-runner";

async function main() {
  const result = await runFlightSearch();
  console.log(JSON.stringify(result, null, 2));

  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
