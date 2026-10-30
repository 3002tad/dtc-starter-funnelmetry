// Fail-closed preflight for the rendered source-owner Compose CDC overrides.
// Reads the full rendered config from stdin but never prints it or its secrets.
import { pathToFileURL } from 'node:url'

export function checkCdcSourceConfig(config, env) {
  const cap = env.CDC_MAX_SLOT_WAL_KEEP_MB
  if (!/^[1-9][0-9]*$/.test(cap || '') || Number(cap) > 2147483647) {
    throw Error('CDC_MAX_SLOT_WAL_KEEP_MB must be a finite positive integer')
  }
  const networkName = env.CDC_SOURCE_NETWORK
  if (!/^[a-zA-Z][a-zA-Z0-9_.-]{1,127}$/.test(networkName || '')) {
    throw Error('CDC_SOURCE_NETWORK must be an explicit Docker network name')
  }

  const postgres = config?.services?.postgres
  if (!postgres || !config.services?.backend) {
    throw Error('Medusa postgres/backend Compose services are required')
  }
  const expectedCommand = ['postgres', '-c', 'wal_level=logical', '-c',
    `max_slot_wal_keep_size=${cap}MB`]
  if (JSON.stringify(postgres.command) !== JSON.stringify(expectedCommand)) {
    throw Error('PostgreSQL logical-WAL command differs from the reviewed override')
  }
  if (!Object.hasOwn(postgres.networks || {}, 'default') ||
      postgres.networks?.source_cdc?.aliases?.join(',') !== 'medusa-cdc-postgres' ||
      config.networks?.source_cdc?.external !== true ||
      config.networks?.source_cdc?.name !== networkName ||
      Object.hasOwn(config.services.backend.networks || {}, 'source_cdc')) {
    throw Error('CDC source network attachment differs from the reviewed scope')
  }
  const ports = postgres.ports || []
  if (ports.length !== 1 || ports[0].host_ip !== '127.0.0.1' ||
      Number(ports[0].target) !== 5432 || Number(ports[0].published) !== 5432) {
    throw Error('PostgreSQL must retain its single loopback-only port')
  }
  const volumes = postgres.volumes || []
  if (volumes.length !== 1 || volumes[0].type !== 'volume' ||
      volumes[0].source !== 'postgres_data' ||
      volumes[0].target !== '/var/lib/postgresql/data') {
    throw Error('PostgreSQL data volume differs from the reviewed scope')
  }
  return { status: 'CDC_SOURCE_CONFIG_MATCH', walCapMiB: Number(cap),
    sourceNetwork: networkName }
}

async function main() {
  let input = ''
  for await (const chunk of process.stdin) input += chunk
  let config
  try { config = JSON.parse(input) } catch { throw Error('rendered Compose JSON is required on stdin') }
  const result = checkCdcSourceConfig(config, process.env)
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`cdc-source-preflight: ${error.message}`)
    process.exitCode = 1
  })
}
