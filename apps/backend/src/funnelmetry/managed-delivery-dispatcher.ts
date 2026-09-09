type Logger = { warn: (message: string) => void }

type MappedSourceEvent = {
  eventId: string
  sourceEventType: string
  occurredAt: string
  aggregate: { type: string; id: string }
  sourcePayload: Record<string, unknown>
}

type DeliveryResult = { status: "accepted" | "duplicate" | "rejected" | "retryable_failure" }
type BackendForwarder = { forward: (event: MappedSourceEvent) => Promise<DeliveryResult> }

type ManagedDeliveryOptions = {
  sourceId: string
  sourceKeyId: string
  endpoint: string
  signingKey: string
  timeoutMs: number
  maxAttempts: number
  maxQueueSize: number
  failureThreshold: number
  cooldownMs: number
  logger: Logger
}

type ManagedDeliveryMetrics = {
  enqueued: number
  accepted: number
  duplicate: number
  rejected: number
  retryableFailure: number
  droppedQueueFull: number
  droppedAfterRetry: number
  circuitOpened: number
}

export function createManagedDeliveryDispatcher(options: ManagedDeliveryOptions) {
  const queue: MappedSourceEvent[] = []
  const metrics: ManagedDeliveryMetrics = {
    enqueued: 0,
    accepted: 0,
    duplicate: 0,
    rejected: 0,
    retryableFailure: 0,
    droppedQueueFull: 0,
    droppedAfterRetry: 0,
    circuitOpened: 0,
  }
  let draining = false
  let wakeTimer: ReturnType<typeof setTimeout> | undefined
  let circuitOpenUntil = 0
  let consecutiveRetryableFailures = 0
  let lastQueueFullLogAt = 0
  let forwarder: BackendForwarder | undefined

  async function getForwarder() {
    if (forwarder) return forwarder
    const kit = await import("@3002tad/funnelmetry-backend-integration-kit")
    forwarder = kit.createBackendForwarder({
      sourceId: options.sourceId,
      sourceKeyId: options.sourceKeyId,
      endpoint: options.endpoint,
      signingKey: options.signingKey,
      timeoutMs: options.timeoutMs,
      maxAttempts: options.maxAttempts,
      logger: { warn: (entry: unknown) => options.logger.warn(JSON.stringify(entry)) },
    }) as BackendForwarder
    return forwarder
  }

  function scheduleDrain(delayMs = 0) {
    if (draining || wakeTimer) return
    wakeTimer = setTimeout(() => {
      wakeTimer = undefined
      void drain()
    }, delayMs)
  }

  function openCircuit() {
    circuitOpenUntil = Date.now() + options.cooldownMs
    consecutiveRetryableFailures = 0
    metrics.circuitOpened += 1
    options.logger.warn(JSON.stringify({
      message: "Funnelmetry delivery circuit opened; Medusa business flow remains unaffected",
      cooldown_ms: options.cooldownMs,
      queued_events: queue.length,
    }))
  }

  async function drain() {
    if (draining) return
    const remainingCooldown = circuitOpenUntil - Date.now()
    if (remainingCooldown > 0) {
      scheduleDrain(remainingCooldown)
      return
    }
    draining = true
    try {
      while (queue.length > 0) {
        const remainingCooldownDuringDrain = circuitOpenUntil - Date.now()
        if (remainingCooldownDuringDrain > 0) {
          scheduleDrain(remainingCooldownDuringDrain)
          break
        }
        const event = queue.shift()
        if (!event) continue
        try {
          const result = await (await getForwarder()).forward(event)
          if (result.status === "accepted") {
            metrics.accepted += 1
            consecutiveRetryableFailures = 0
          } else if (result.status === "duplicate") {
            metrics.duplicate += 1
            consecutiveRetryableFailures = 0
          } else if (result.status === "rejected") {
            metrics.rejected += 1
            consecutiveRetryableFailures = 0
          } else {
            metrics.retryableFailure += 1
            metrics.droppedAfterRetry += 1
            consecutiveRetryableFailures += 1
            if (consecutiveRetryableFailures >= options.failureThreshold) {
              openCircuit()
              break
            }
          }
        } catch (error) {
          metrics.retryableFailure += 1
          metrics.droppedAfterRetry += 1
          consecutiveRetryableFailures += 1
          options.logger.warn(JSON.stringify({
            message: "Funnelmetry managed delivery failed open",
            error: error instanceof Error ? error.message : "unknown error",
          }))
          if (consecutiveRetryableFailures >= options.failureThreshold) {
            openCircuit()
            break
          }
        }
      }
    } finally {
      draining = false
      if (queue.length > 0) {
        scheduleDrain(Math.max(0, circuitOpenUntil - Date.now()))
      }
    }
  }

  function enqueue(event: MappedSourceEvent) {
    if (queue.length >= options.maxQueueSize) {
      metrics.droppedQueueFull += 1
      if (Date.now() - lastQueueFullLogAt >= 60000) {
        lastQueueFullLogAt = Date.now()
        options.logger.warn(JSON.stringify({
          message: "Funnelmetry delivery queue is full; event dropped without affecting Medusa",
          max_queue_size: options.maxQueueSize,
        }))
      }
      return { status: "dropped_queue_full" as const }
    }
    queue.push(event)
    metrics.enqueued += 1
    scheduleDrain(Math.max(0, circuitOpenUntil - Date.now()))
    return { status: "queued" as const }
  }

  return Object.freeze({
    enqueue,
    getMetrics: () => ({
      ...metrics,
      queued: queue.length,
      circuitOpen: circuitOpenUntil > Date.now(),
    }),
  })
}
