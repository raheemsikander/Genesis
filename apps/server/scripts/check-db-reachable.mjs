import pg from "pg";

const CONNECT_TIMEOUT_MS = 20_000;

/**
 * Distinct from the generic exit 1 so the caller can tell "the host answered
 * but the database did not" apart from a broken script or an unreachable host,
 * and only suggest recreating the database in the first case. A deleted Render
 * database still resolves and accepts TCP, so network-level errors never mean
 * expiry.
 */
const EXIT_HANDSHAKE_FAILED = 2;
const NETWORK_ERROR_CODES = new Set([
	"ENOTFOUND",
	"EAI_AGAIN",
	"ECONNREFUSED",
	"ETIMEDOUT",
	"EHOSTUNREACH",
]);

/**
 * Completes a real Postgres handshake rather than a TCP probe. Render serves
 * every *.render.com hostname from wildcard DNS behind a shared proxy, so a
 * deleted database still resolves and still accepts the socket; the proxy
 * only drops the connection once the startup message arrives.
 */
const client = new pg.Client({
	connectionString: process.env.DATABASE_URL,
	connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
});

try {
	await client.connect();
	await client.query("select 1");
	console.log(`Database reachable at ${client.host}:${client.port}`);
} catch (error) {
	console.error(`Cannot reach ${client.host}:${client.port}: ${error.message}`);
	process.exitCode = NETWORK_ERROR_CODES.has(error.code)
		? 1
		: EXIT_HANDSHAKE_FAILED;
} finally {
	await client.end().catch(() => {});
}
