import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkCdcSourceConfig } from './check-cdc-source-config.mjs'

const env = { CDC_MAX_SLOT_WAL_KEEP_MB: '1024',
  CDC_SOURCE_NETWORK: 'funnelmetry_cdc_source' }
const config = () => ({
  services: {
    postgres: {
      command: ['postgres', '-c', 'wal_level=logical', '-c',
        'max_slot_wal_keep_size=1024MB'],
      networks: { default: {}, source_cdc: { aliases: ['medusa-cdc-postgres'] } },
      ports: [{ host_ip: '127.0.0.1', target: 5432, published: '5432' }],
      volumes: [{ type: 'volume', source: 'postgres_data',
        target: '/var/lib/postgresql/data' }],
    },
    backend: { networks: { default: {}, source_ingress: {} } },
  },
  networks: { source_cdc: { external: true, name: 'funnelmetry_cdc_source' } },
})

test('requires a bounded cap and the exact private source attachment', () => {
  assert.equal(checkCdcSourceConfig(config(), env).status, 'CDC_SOURCE_CONFIG_MATCH')
  for (const cap of [undefined, '', '-1', '0', '1GB', '2147483648']) {
    assert.throws(() => checkCdcSourceConfig(config(), {
      ...env, CDC_MAX_SLOT_WAL_KEEP_MB: cap }), /finite positive integer/)
  }
  const publicPort = config()
  publicPort.services.postgres.ports[0].host_ip = '0.0.0.0'
  assert.throws(() => checkCdcSourceConfig(publicPort, env), /loopback-only/)
  const lostVolume = config()
  lostVolume.services.postgres.volumes[0].source = 'another_data'
  assert.throws(() => checkCdcSourceConfig(lostVolume, env), /data volume/)
  const backendOnCdc = config()
  backendOnCdc.services.backend.networks.source_cdc = {}
  assert.throws(() => checkCdcSourceConfig(backendOnCdc, env), /network attachment/)
  const unlimited = config()
  unlimited.services.postgres.command[4] = 'max_slot_wal_keep_size=-1'
  assert.throws(() => checkCdcSourceConfig(unlimited, env), /logical-WAL command/)
})
