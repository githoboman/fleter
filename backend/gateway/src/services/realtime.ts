import { EventEmitter } from 'events';

export type GatewayInvalidation = {
  reason: 'startup' | 'polling-fallback' | 'reactivity-event';
  eventName?: string;
  marketId?: string | null;
  traderAddress?: string | null;
  occurredAt: string;
};

const emitter = new EventEmitter();

export function publishInvalidation(payload: GatewayInvalidation) {
  emitter.emit('invalidate', payload);
}

export function subscribeToInvalidations(listener: (payload: GatewayInvalidation) => void) {
  emitter.on('invalidate', listener);

  return () => {
    emitter.off('invalidate', listener);
  };
}
